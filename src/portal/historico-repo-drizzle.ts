import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  cliente,
  membro,
  orcamento,
  orcamentoItem,
  ordemServico,
  servico,
  solicitacao,
} from "@/db/schema";
import type {
  HistoricoRepo,
  OsHistorico,
  SolicitacaoHistorico,
} from "./historico-repo";
import type { ItemView } from "@/operacao/aprovacao-repo";

type SolicitacaoRow = {
  id: string;
  token: string;
  criadoEm: Date;
  endereco: {
    cidade: string;
    uf: string;
  } | null;
};

function montarSolicitacao(
  row: SolicitacaoRow,
  ordens: OsHistorico[],
): SolicitacaoHistorico {
  return {
    id: row.id,
    token: row.token,
    protocolo: row.token.slice(0, 8).toUpperCase(),
    criadoEm: row.criadoEm,
    cidade: row.endereco?.cidade ?? null,
    uf: row.endereco?.uf ?? null,
    ordens,
  };
}

export function criarHistoricoRepoDrizzle(db: DB): HistoricoRepo {
  async function carregarOrdens(solicitacaoIds: string[]) {
    if (solicitacaoIds.length === 0) return new Map<string, OsHistorico[]>();

    const rows = await db
      .select({
        solicitacaoId: ordemServico.solicitacaoId,
        id: ordemServico.id,
        categoria: ordemServico.categoria,
        estado: ordemServico.estado,
        agendadoPara: ordemServico.agendadoPara,
        tecnicoId: membro.id,
        tecnicoNome: membro.nome,
        tecnicoFotoUrl: membro.fotoUrl,
        tecnicoSlug: membro.slug,
      })
      .from(ordemServico)
      .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
      .where(inArray(ordemServico.solicitacaoId, solicitacaoIds))
      .orderBy(asc(ordemServico.criadoEm));

    const osIds = rows.map((row) => row.id);
    const orcamentos = osIds.length
      ? await db
          .select({
            id: orcamento.id,
            osId: orcamento.osId,
            total: orcamento.total,
            totalDeslocamento: orcamento.totalDeslocamento,
            validoAte: orcamento.validoAte,
            criadoEm: orcamento.criadoEm,
          })
          .from(orcamento)
          .where(inArray(orcamento.osId, osIds))
          .orderBy(desc(orcamento.criadoEm))
      : [];
    const orcamentoPorOs = new Map<string, (typeof orcamentos)[number]>();
    for (const orc of orcamentos) {
      if (!orcamentoPorOs.has(orc.osId)) orcamentoPorOs.set(orc.osId, orc);
    }

    const orcamentoIds = [...orcamentoPorOs.values()].map((orc) => orc.id);
    const itens = orcamentoIds.length
      ? await db
          .select({
            orcamentoId: orcamentoItem.orcamentoId,
            nome: servico.nome,
            quantidade: orcamentoItem.quantidade,
            precoUnitario: orcamentoItem.precoUnitario,
            subtotal: orcamentoItem.subtotal,
          })
          .from(orcamentoItem)
          .innerJoin(servico, eq(orcamentoItem.servicoId, servico.id))
          .where(inArray(orcamentoItem.orcamentoId, orcamentoIds))
      : [];
    const itensPorOrcamento = new Map<string, ItemView[]>();
    for (const item of itens) {
      const lista = itensPorOrcamento.get(item.orcamentoId) ?? [];
      lista.push({
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      });
      itensPorOrcamento.set(item.orcamentoId, lista);
    }

    const porSolicitacao = new Map<string, OsHistorico[]>();
    for (const row of rows) {
      const ordens = porSolicitacao.get(row.solicitacaoId) ?? [];
      const orc = orcamentoPorOs.get(row.id);
      ordens.push({
        id: row.id,
        categoria: row.categoria,
        estado: row.estado,
        agendadoPara: row.agendadoPara,
        tecnico:
          row.tecnicoId && row.tecnicoNome
            ? {
                id: row.tecnicoId,
                nome: row.tecnicoNome,
                fotoUrl: row.tecnicoFotoUrl,
                slug: row.tecnicoSlug,
              }
            : null,
        orcamento: orc
          ? {
              total: orc.total,
              totalDeslocamento: orc.totalDeslocamento,
              validoAte: orc.validoAte,
              itens: itensPorOrcamento.get(orc.id) ?? [],
            }
          : null,
      });
      porSolicitacao.set(row.solicitacaoId, ordens);
    }

    return porSolicitacao;
  }

  return {
    async listar(whatsapp, paginacao) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(solicitacao)
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(eq(cliente.whatsapp, whatsapp));

      const solicitacoes = await db
        .select({
          id: solicitacao.id,
          token: solicitacao.token,
          criadoEm: solicitacao.criadoEm,
          endereco: solicitacao.endereco,
        })
        .from(solicitacao)
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(eq(cliente.whatsapp, whatsapp))
        .orderBy(desc(solicitacao.criadoEm))
        .limit(paginacao.limit)
        .offset(paginacao.offset);

      const ordens = await carregarOrdens(solicitacoes.map((s) => s.id));

      return {
        itens: solicitacoes.map((sol) =>
          montarSolicitacao(sol, ordens.get(sol.id) ?? []),
        ),
        total: total ?? 0,
      };
    },

    async carregarSolicitacao(solicitacaoId, whatsapp) {
      const [sol] = await db
        .select({
          id: solicitacao.id,
          token: solicitacao.token,
          criadoEm: solicitacao.criadoEm,
          endereco: solicitacao.endereco,
        })
        .from(solicitacao)
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(
          and(
            eq(solicitacao.id, solicitacaoId),
            eq(cliente.whatsapp, whatsapp),
          ),
        )
        .limit(1);

      if (!sol) return null;

      const ordens = await carregarOrdens([sol.id]);
      return montarSolicitacao(sol, ordens.get(sol.id) ?? []);
    },
  };
}
