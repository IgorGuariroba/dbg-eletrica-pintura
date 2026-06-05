import type { AvaliacaoRepo, SolicitacaoAvaliacaoView } from "./avaliacao-repo";
import type { DB } from "@/db/client";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import * as schema from "@/db/schema";

export function criarAvaliacaoRepoDrizzle(db: DB): AvaliacaoRepo {
  return {
    async salvarAvaliacao(osId, dados) {
      await db
        .insert(schema.avaliacao)
        .values({
          osId,
          tecnicoId: dados.tecnicoId,
          nota: dados.nota,
          comentarioOs: dados.comentarioOs,
          atorToken: dados.atorToken,
          ip: dados.ip,
        })
        .onConflictDoUpdate({
          target: schema.avaliacao.osId,
          set: {
            nota: dados.nota,
            comentarioOs: dados.comentarioOs,
            tecnicoId: dados.tecnicoId,
            atorToken: dados.atorToken,
            ip: dados.ip,
            atualizadoEm: new Date(),
          },
        });
    },

    async salvarComentarioGeral(solicitacaoId, dados) {
      await db
        .insert(schema.comentarioGeral)
        .values({
          solicitacaoId,
          comentario: dados.comentario,
          atorToken: dados.atorToken,
          ip: dados.ip,
        })
        .onConflictDoUpdate({
          target: schema.comentarioGeral.solicitacaoId,
          set: {
            comentario: dados.comentario,
            atorToken: dados.atorToken,
            ip: dados.ip,
            atualizadoEm: new Date(),
          },
        });
    },

    async carregarPorToken(token): Promise<SolicitacaoAvaliacaoView | null> {
      // 1. Solicitação + cliente.
      const [sol] = await db
        .select({
          id: schema.solicitacao.id,
          token: schema.solicitacao.token,
          clienteNome: schema.cliente.nome,
          clienteEmail: schema.cliente.email,
          clienteWhatsapp: schema.cliente.whatsapp,
        })
        .from(schema.solicitacao)
        .innerJoin(schema.cliente, eq(schema.solicitacao.clienteId, schema.cliente.id))
        .where(eq(schema.solicitacao.token, token))
        .limit(1);

      if (!sol) return null;

      // 2. Comentário geral, se houver.
      const [comGeral] = await db
        .select({ comentario: schema.comentarioGeral.comentario })
        .from(schema.comentarioGeral)
        .where(eq(schema.comentarioGeral.solicitacaoId, sol.id))
        .limit(1);

      // 3. OS avaliáveis (CONCLUIDA ou PAGA).
      const ordens = await db
        .select({
          id: schema.ordemServico.id,
          tipo: schema.ordemServico.tipo,
          estado: schema.ordemServico.estado,
          categoria: schema.ordemServico.categoria,
          tecnicoId: schema.membro.id,
          tecnicoNome: schema.membro.nome,
        })
        .from(schema.ordemServico)
        .leftJoin(schema.membro, eq(schema.ordemServico.tecnicoId, schema.membro.id))
        .where(
          and(
            eq(schema.ordemServico.solicitacaoId, sol.id),
            or(
              eq(schema.ordemServico.estado, "CONCLUIDA"),
              eq(schema.ordemServico.estado, "PAGA")
            )
          )
        )
        .orderBy(asc(schema.ordemServico.criadoEm));

      if (ordens.length === 0) {
        return {
          token: sol.token,
          clienteNome: sol.clienteNome,
          clienteEmail: sol.clienteEmail,
          clienteWhatsapp: sol.clienteWhatsapp,
          solicitacaoId: sol.id,
          comentarioGeral: comGeral?.comentario ?? null,
          ordens: [],
        };
      }

      // 4. Avaliações já existentes destas OS (pré-preenchimento).
      const osIds = ordens.map((o) => o.id);
      const evaluations = await db
        .select({
          osId: schema.avaliacao.osId,
          nota: schema.avaliacao.nota,
          comentarioOs: schema.avaliacao.comentarioOs,
        })
        .from(schema.avaliacao)
        .where(inArray(schema.avaliacao.osId, osIds));

      const evalMap = new Map(evaluations.map((e) => [e.osId, e]));

      return {
        token: sol.token,
        clienteNome: sol.clienteNome,
        clienteEmail: sol.clienteEmail,
        clienteWhatsapp: sol.clienteWhatsapp,
        solicitacaoId: sol.id,
        comentarioGeral: comGeral?.comentario ?? null,
        ordens: ordens.map((o) => ({
          id: o.id,
          tipo: o.tipo,
          estado: o.estado,
          categoria: o.categoria,
          tecnicoId: o.tecnicoId,
          tecnicoNome: o.tecnicoNome,
          avaliacao: evalMap.get(o.id)
            ? {
                nota: evalMap.get(o.id)!.nota,
                comentarioOs: evalMap.get(o.id)!.comentarioOs ?? null,
              }
            : null,
        })),
      };
    },

    async verificarPertencimento(token, osIds) {
      if (osIds.length === 0) return true;
      const rows = await db
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .innerJoin(schema.solicitacao, eq(schema.ordemServico.solicitacaoId, schema.solicitacao.id))
        .where(
          and(
            eq(schema.solicitacao.token, token),
            inArray(schema.ordemServico.id, osIds),
            or(
              eq(schema.ordemServico.estado, "CONCLUIDA"),
              eq(schema.ordemServico.estado, "PAGA")
            )
          )
        );
      return rows.length === osIds.length;
    },

    async obterTecnicoSnapshot(osId) {
      const [os] = await db
        .select({ tecnicoId: schema.ordemServico.tecnicoId })
        .from(schema.ordemServico)
        .where(eq(schema.ordemServico.id, osId))
        .limit(1);
      return os?.tecnicoId ?? null;
    },

    async obterSolicitacaoIdPorToken(token) {
      const [sol] = await db
        .select({ id: schema.solicitacao.id })
        .from(schema.solicitacao)
        .where(eq(schema.solicitacao.token, token))
        .limit(1);
      return sol?.id ?? null;
    },
  };
}
