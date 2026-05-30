import { desc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { orcamento, ordemServico } from "@/db/schema";
import type { ReativacaoRepo } from "./reativacao-repo";

export function criarReativacaoRepoDrizzle(db: DB): ReativacaoRepo {
  return {
    async buscarOs(osId) {
      const [os] = await db
        .select({
          id: ordemServico.id,
          estado: ordemServico.estado,
          metadados: ordemServico.metadados,
        })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      return os ?? null;
    },

    async reativar(osId, novoEstado, novosMetadados, novaValidade) {
      // Subquery: o orçamento mais recente da OS. Resolvida dentro do mesmo
      // UPDATE para dispensar um SELECT prévio e caber no batch transacional.
      const orcamentoMaisRecente = db
        .select({ id: orcamento.id })
        .from(orcamento)
        .where(eq(orcamento.osId, osId))
        .orderBy(desc(orcamento.criadoEm))
        .limit(1);

      // Atomicidade: o driver neon-http só suporta transações em batch
      // (array de queries, único round-trip). Os dois UPDATEs vão juntos —
      // ou ambos aplicam, ou nenhum.
      const [atualizados] = await db.batch([
        db
          .update(ordemServico)
          .set({
            estado: novoEstado,
            metadados: novosMetadados,
          })
          .where(eq(ordemServico.id, osId))
          .returning({ id: ordemServico.id }),
        db
          .update(orcamento)
          .set({
            validoAte: novaValidade,
            rejeitadoEm: null,
          })
          .where(inArray(orcamento.id, orcamentoMaisRecente)),
      ]);

      return atualizados.length > 0;
    },
  };
}
