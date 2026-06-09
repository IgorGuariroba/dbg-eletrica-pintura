import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  avaliacao,
  cliente,
  ordemServico,
  solicitacao,
} from "@/db/schema";
import { NOTA_MINIMA_QUALIFICACAO } from "@/marketing/filtro-avaliacao";
import { primeiroNomeInicial } from "@/lib/nome";
import type {
  DepoimentoCandidato,
  DepoimentosQuery,
} from "./depoimentos-query";

export function criarDepoimentosQueryDrizzle(db: DB): DepoimentosQuery {
  // Filtros de qualificação compartilhados: nota mínima, não invalidada e com
  // comentário (sem texto não há depoimento).
  const qualifica = and(
    gte(avaliacao.nota, NOTA_MINIMA_QUALIFICACAO),
    eq(avaliacao.invalida, false),
    isNotNull(avaliacao.comentarioOs),
  );

  function baseSelect() {
    return db
      .select({
        avaliacaoId: avaliacao.id,
        nota: avaliacao.nota,
        comentarioOs: avaliacao.comentarioOs,
        clienteNome: cliente.nome,
        criadoEm: avaliacao.criadoEm,
      })
      .from(avaliacao)
      .innerJoin(ordemServico, eq(avaliacao.osId, ordemServico.id))
      .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
      .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id));
  }

  function toCandidato(r: {
    avaliacaoId: string;
    nota: number;
    comentarioOs: string | null;
    clienteNome: string;
  }): DepoimentoCandidato {
    return {
      avaliacaoId: r.avaliacaoId,
      nome: primeiroNomeInicial(r.clienteNome),
      texto: r.comentarioOs ?? "",
      nota: r.nota,
    };
  }

  return {
    async listarCandidatos(limit = 50) {
      const linhas = await baseSelect()
        .where(qualifica)
        .orderBy(desc(avaliacao.criadoEm))
        .limit(limit);
      return linhas.map(toCandidato);
    },

    async porIds(avaliacaoIds) {
      if (avaliacaoIds.length === 0) return [];
      const linhas = await baseSelect().where(
        and(qualifica, inArray(avaliacao.id, avaliacaoIds)),
      );
      const porId = new Map(linhas.map((l) => [l.avaliacaoId, toCandidato(l)]));
      // Preserva a ordem solicitada; descarta ids que não qualificam mais.
      return avaliacaoIds
        .map((id) => porId.get(id))
        .filter((c): c is DepoimentoCandidato => c != null);
    },
  };
}
