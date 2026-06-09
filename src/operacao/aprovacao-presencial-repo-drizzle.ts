import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { orcamento, ordemServico, transicaoOs, indicacao, solicitacao } from "@/db/schema";
import type { AprovacaoPresencialRepo } from "./aprovacao-presencial";

export function criarAprovacaoPresencialRepoDrizzle(
  db: DB,
): AprovacaoPresencialRepo {
  return {
    async aprovarPresencial({ osId, assinaturaUrl, aprovadoPor, lgpdAceito, em }) {
      // Portão atômico: só transita se a OS ainda está ORÇADA.
      const transitadas = await db
        .update(ordemServico)
        .set({ estado: "APROVADA" })
        .where(
          and(eq(ordemServico.id, osId), eq(ordemServico.estado, "ORCADA")),
        )
        .returning({ id: ordemServico.id });
      if (transitadas.length === 0) return false;

      // Carimba a aprovação presencial no orçamento mais recente da OS.
      const [orc] = await db
        .select({ id: orcamento.id, descontoIndicacao: orcamento.descontoIndicacao })
        .from(orcamento)
        .where(eq(orcamento.osId, osId))
        .orderBy(desc(orcamento.criadoEm))
        .limit(1);
      if (orc) {
        await db
          .update(orcamento)
          .set({
            aprovadoEm: em,
            aprovacaoTipo: "PRESENCIAL",
            assinaturaUrl,
            aprovacaoPor: aprovadoPor,
            aprovacaoLgpd: lgpdAceito,
          })
          .where(eq(orcamento.id, orc.id));

        if (orc.descontoIndicacao && Number(orc.descontoIndicacao) > 0) {
          const [sol] = await db
            .select({ clienteId: solicitacao.clienteId })
            .from(solicitacao)
            .innerJoin(ordemServico, eq(solicitacao.id, ordemServico.solicitacaoId))
            .where(eq(ordemServico.id, osId))
            .limit(1);
          if (sol) {
            await db
              .update(indicacao)
              .set({ descontoAplicado: true })
              .where(eq(indicacao.indicadoId, sol.clienteId));
          }
        }
      }

      // Registra a transição no histórico de campo (ORCADA → APROVADA).
      await db.insert(transicaoOs).values({
        osId,
        estadoAnterior: "ORCADA",
        estadoNovo: "APROVADA",
        atorEmail: aprovadoPor,
        em,
      });
      return true;
    },

    async podeIniciarExecucao(osId): Promise<boolean> {
      const [os] = await db
        .select({ tipo: ordemServico.tipo })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      if (!os) return false;
      // Express e Complementar presencial executam direto após aprovar.
      if (os.tipo === "EXPRESS" || os.tipo === "COMPLEMENTAR") return true;
      // NORMAL (Visita Técnica): só se o técnico já esteve NO_LOCAL.
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(transicaoOs)
        .where(
          and(
            eq(transicaoOs.osId, osId),
            eq(transicaoOs.estadoNovo, "NO_LOCAL"),
          ),
        );
      return n > 0;
    },
  };
}
