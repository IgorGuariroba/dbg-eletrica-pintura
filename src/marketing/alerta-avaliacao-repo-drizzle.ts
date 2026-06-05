import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { alertaAvaliacao, membro } from "@/db/schema";
import type { AlertaAvaliacaoRepo, AlertaAvaliacaoInput, AlertaPendenteView } from "./alerta-avaliacao-repo";

export function criarAlertaAvaliacaoRepoDrizzle(db: DB): AlertaAvaliacaoRepo {
  return {
    async criar(dados: AlertaAvaliacaoInput): Promise<void> {
      await db
        .insert(alertaAvaliacao)
        .values({
          osId: dados.osId,
          solicitacaoId: dados.solicitacaoId,
          tecnicoId: dados.tecnicoId,
          nota: dados.nota,
          comentarioOs: dados.comentarioOs ?? null,
          status: "PENDENTE",
        })
        .onConflictDoUpdate({
          target: alertaAvaliacao.osId,
          set: {
            nota: dados.nota,
            comentarioOs: dados.comentarioOs ?? null,
            tecnicoId: dados.tecnicoId,
            status: "PENDENTE",
            atualizadoEm: new Date(),
          },
        });
    },

    async listarPendentes(): Promise<AlertaPendenteView[]> {
      const rows = await db
        .select({
          id: alertaAvaliacao.id,
          osId: alertaAvaliacao.osId,
          solicitacaoId: alertaAvaliacao.solicitacaoId,
          tecnicoNome: membro.nome,
          nota: alertaAvaliacao.nota,
          comentarioOs: alertaAvaliacao.comentarioOs,
          status: alertaAvaliacao.status,
          criadoEm: alertaAvaliacao.criadoEm,
        })
        .from(alertaAvaliacao)
        .leftJoin(membro, eq(alertaAvaliacao.tecnicoId, membro.id))
        .where(eq(alertaAvaliacao.status, "PENDENTE"));

      return rows;
    }
  };
}
