import { and, between, eq, gte, lte } from "drizzle-orm";
import type { DB } from "@/db/client";
import { alertaAvaliacao, avaliacao, membro } from "@/db/schema";
import type { AlertaAvaliacaoRepo, AlertaAvaliacaoInput, AlertaPendenteView, AvaliacaoAdminView, FiltroAvaliacoes } from "./alerta-avaliacao-repo";

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
    },

    async listarTodas(filtro?: FiltroAvaliacoes): Promise<AvaliacaoAdminView[]> {
      const conditions = [];

      if (filtro?.nota !== undefined) {
        conditions.push(eq(alertaAvaliacao.nota, filtro.nota));
      }
      if (filtro?.tecnicoId) {
        conditions.push(eq(alertaAvaliacao.tecnicoId, filtro.tecnicoId));
      }
      if (filtro?.de) {
        conditions.push(gte(alertaAvaliacao.criadoEm, filtro.de));
      }
      if (filtro?.ate) {
        conditions.push(lte(alertaAvaliacao.criadoEm, filtro.ate));
      }

      const rows = await db
        .select({
          id: alertaAvaliacao.id,
          osId: alertaAvaliacao.osId,
          solicitacaoId: alertaAvaliacao.solicitacaoId,
          tecnicoId: alertaAvaliacao.tecnicoId,
          tecnicoNome: membro.nome,
          nota: alertaAvaliacao.nota,
          comentarioOs: alertaAvaliacao.comentarioOs,
          criadoEm: alertaAvaliacao.criadoEm,
          status: alertaAvaliacao.status,
          resolvidoEm: alertaAvaliacao.resolvidoEm,
          avaliacaoInvalida: avaliacao.invalida,
          avaliacaoMotivoInvalidacao: avaliacao.motivoInvalidacao,
        })
        .from(alertaAvaliacao)
        .leftJoin(membro, eq(alertaAvaliacao.tecnicoId, membro.id))
        .leftJoin(avaliacao, eq(alertaAvaliacao.osId, avaliacao.osId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(alertaAvaliacao.criadoEm);

      return rows.map((r) => ({
        id: r.id,
        osId: r.osId,
        solicitacaoId: r.solicitacaoId,
        tecnicoId: r.tecnicoId,
        tecnicoNome: r.tecnicoNome ?? null,
        nota: r.nota,
        comentarioOs: r.comentarioOs,
        criadoEm: r.criadoEm,
        status: r.status,
        resolvidoEm: r.resolvidoEm,
        avaliacaoInvalida: r.avaliacaoInvalida ?? false,
        avaliacaoMotivoInvalidacao: r.avaliacaoMotivoInvalidacao ?? null,
      }));
    },
  };
}
