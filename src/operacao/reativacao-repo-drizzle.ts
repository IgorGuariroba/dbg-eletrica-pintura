import { desc, eq } from "drizzle-orm";
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
      const atualizados = await db
        .update(ordemServico)
        .set({
          estado: novoEstado,
          metadados: novosMetadados,
        })
        .where(eq(ordemServico.id, osId))
        .returning({ id: ordemServico.id });

      if (atualizados.length === 0) {
        return false;
      }

      // Busca o orçamento mais recente da OS para atualizar a validade
      const [orc] = await db
        .select({ id: orcamento.id })
        .from(orcamento)
        .where(eq(orcamento.osId, osId))
        .orderBy(desc(orcamento.criadoEm))
        .limit(1);

      if (orc) {
        await db
          .update(orcamento)
          .set({
            validoAte: novaValidade,
            rejeitadoEm: null,
          })
          .where(eq(orcamento.id, orc.id));
      }

      return true;
    },
  };
}
