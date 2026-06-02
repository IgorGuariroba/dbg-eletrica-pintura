import { and, asc, count, desc, eq, gte, isNull, lte, sql, sum } from "drizzle-orm";
import type { DB } from "@/db/client";
import { cliente, orcamento, ordemServico, pagamento, solicitacao, transicaoOs } from "@/db/schema";
import type { FinanceiroRepo, PagamentoConfirmado, PagamentoPendente, ResumoFinanceiro } from "./financeiro";
import { calcularTicketMedio } from "./ticket";

export function criarFinanceiroRepoDrizzle(db: DB): FinanceiroRepo {
  return {
    async listarPendentes(): Promise<PagamentoPendente[]> {
      const rows = await db
        .select({
          osId: ordemServico.id,
          clienteNome: cliente.nome,
          clienteWhatsapp: cliente.whatsapp,
          token: solicitacao.token,
          valor: orcamento.total,
          diasPendente: sql<number>`coalesce(floor(extract(epoch from (now() - ${transicaoOs.em})) / 86400), 0)::integer`,
          categoria: ordemServico.categoria,
        })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .innerJoin(
          orcamento,
          eq(
            orcamento.id,
            sql`(SELECT id FROM orcamento WHERE os_id = ${ordemServico.id} AND aprovado_em IS NOT NULL ORDER BY criado_em DESC LIMIT 1)`
          )
        )
        .leftJoin(
          transicaoOs,
          eq(
            transicaoOs.id,
            sql`(SELECT id FROM transicao_os WHERE os_id = ${ordemServico.id} AND estado_novo = 'CONCLUIDA' ORDER BY em DESC LIMIT 1)`
          )
        )
        .leftJoin(
          pagamento,
          and(eq(pagamento.osId, ordemServico.id), eq(pagamento.status, "approved"))
        )
        .where(
          and(
            eq(ordemServico.estado, "CONCLUIDA"),
            isNull(pagamento.osId)
          )
        )
        .orderBy(asc(sql`coalesce(${transicaoOs.em}, ${ordemServico.criadoEm})`));

      return rows;
    },
    async listarConfirmados(intervalo: { inicio: Date; fim: Date }): Promise<PagamentoConfirmado[]> {
      const rows = await db
        .select({
          osId: pagamento.osId,
          clienteNome: cliente.nome,
          valor: pagamento.valor,
          metodo: pagamento.metodo,
          pagoEm: pagamento.criadoEm,
        })
        .from(pagamento)
        .innerJoin(ordemServico, eq(pagamento.osId, ordemServico.id))
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(
          and(
            eq(pagamento.status, "approved"),
            gte(pagamento.criadoEm, intervalo.inicio),
            lte(pagamento.criadoEm, intervalo.fim)
          )
        )
        .orderBy(desc(pagamento.criadoEm));

      return rows;
    },
    async resumoPeriodo(intervalo: { inicio: Date; fim: Date }): Promise<ResumoFinanceiro> {
      const [row] = await db
        .select({
          faturamento: sum(pagamento.valor),
          qtd: count(),
        })
        .from(pagamento)
        .where(
          and(
            eq(pagamento.status, "approved"),
            gte(pagamento.criadoEm, intervalo.inicio),
            lte(pagamento.criadoEm, intervalo.fim)
          )
        );

      const faturamento = row?.faturamento ?? "0.00";
      const qtd = Number(row?.qtd ?? 0);
      const ticketMedio = calcularTicketMedio(faturamento, qtd);

      return {
        faturamento,
        ticketMedio,
        qtdPagamentos: qtd,
      };
    },
  };
}

