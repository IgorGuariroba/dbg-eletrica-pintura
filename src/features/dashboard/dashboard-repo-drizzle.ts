import { and, count, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  membro,
  ordemServico,
  servico,
  transicaoOs,
  garantiaChamado,
  pagamento,
  avaliacao,
  alertaAvaliacao,
  assinatura,
  plano,
  solicitacao,
  orcamento,
  orcamentoItem,
  configRemarketing,
  remarketingEnviado,
  indicacao,
  creditoMovimentacao,
} from "@/db/schema";
import type { Categoria } from "@/operacao/fila-repo";
import type { DashboardRepo } from "./dashboard";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";
import { criarFinanceiroRepoDrizzle } from "@/features/financeiro/financeiro-repo-drizzle";

export function criarDashboardRepoDrizzle(db: DB): DashboardRepo {
  async function contar(
    tabela: typeof servico | typeof membro | typeof ordemServico,
    where: SQL | undefined,
  ) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(tabela)
      .where(where ?? sql`true`);
    return Number(value);
  }

  const possuiModulo = sql`coalesce(array_length(${membro.modulos}, 1), 0) > 0`;

  return {
    contarServicosAtivos() {
      return contar(servico, eq(servico.ativo, true));
    },
    async listarServicosSemDemanda(dias: number) {
      // Serviços ativos que não aparecem em nenhum item de orçamento criado nos
      // últimos `dias` dias (inclui serviços que nunca foram orçados).
      const linhas = await db
        .select({ servicoId: servico.id, nome: servico.nome })
        .from(servico)
        .where(
          and(
            eq(servico.ativo, true),
            sql`not exists (
              select 1 from orcamento_item oi
              join orcamento o on o.id = oi.orcamento_id
              where oi.servico_id = ${servico.id}
                and o.criado_em >= now() - (${dias} * interval '1 day')
            )`,
          ),
        )
        .orderBy(servico.nome);
      return linhas;
    },
    async precoMedioPorCategoria() {
      const linhas = await db
        .select({
          categoria: servico.categoria,
          precoMedio: sql<string>`avg(${servico.precoBase})`,
        })
        .from(servico)
        .where(eq(servico.ativo, true))
        .groupBy(servico.categoria);
      return linhas.map((l) => ({
        categoria: l.categoria,
        precoMedio: Number(l.precoMedio).toFixed(2),
      }));
    },
    contarTecnicosAtivos() {
      return contar(membro, and(eq(membro.isTecnico, true), eq(membro.ativo, true)));
    },
    contarMembrosInternos() {
      return contar(membro, and(possuiModulo, eq(membro.ativo, true)));
    },
    async listarOsPorTecnicoMes() {
      const linhas = await db
        .select({ tecnicoId: membro.id, nome: membro.nome, total: count(ordemServico.id) })
        .from(ordemServico)
        .innerJoin(membro, eq(membro.id, ordemServico.tecnicoId))
        .where(gte(ordemServico.criadoEm, sql`date_trunc('month', now())`))
        .groupBy(membro.id, membro.nome)
        .orderBy(sql`count(${ordemServico.id}) desc`);
      return linhas.map((l) => ({
        tecnicoId: l.tecnicoId,
        nome: l.nome,
        total: Number(l.total),
      }));
    },
    async listarTecnicosComUltimaAtribuicao() {
      const linhas = await db
        .select({
          tecnicoId: membro.id,
          nome: membro.nome,
          ultimaAtribuicao: sql<string | null>`max(${ordemServico.criadoEm})`,
        })
        .from(membro)
        .leftJoin(ordemServico, eq(ordemServico.tecnicoId, membro.id))
        .where(and(eq(membro.isTecnico, true), eq(membro.ativo, true)))
        .groupBy(membro.id, membro.nome);
      return linhas.map((l) => ({
        tecnicoId: l.tecnicoId,
        nome: l.nome,
        ultimaAtribuicao: l.ultimaAtribuicao ? new Date(l.ultimaAtribuicao) : null,
      }));
    },
    contarOsCriadasHoje() {
      return contar(ordemServico, gte(ordemServico.criadoEm, sql`date_trunc('day', now())`));
    },
    contarOsNovasNaFila() {
      return contar(
        ordemServico,
        and(eq(ordemServico.estado, "NOVA"), isNull(ordemServico.tecnicoId)),
      );
    },
    contarOsAguardandoAprovacao() {
      return contar(ordemServico, eq(ordemServico.estado, "ORCADA"));
    },
    contarOsAtribuidasA(tecnicoId: string) {
      return contar(ordemServico, eq(ordemServico.tecnicoId, tecnicoId));
    },
    contarMinhaFila(especialidades: Categoria[]) {
      if (especialidades.length === 0) return Promise.resolve(0);
      return contar(
        ordemServico,
        and(
          eq(ordemServico.estado, "NOVA"),
          isNull(ordemServico.tecnicoId),
          inArray(ordemServico.categoria, especialidades),
        ),
      );
    },
    async contarOsOrcadas30d() {
      const [{ value }] = await db
        .select({ value: sql<number>`count(distinct ${transicaoOs.osId})` })
        .from(transicaoOs)
        .where(
          and(
            eq(transicaoOs.estadoNovo, "ORCADA"),
            gte(transicaoOs.em, sql`now() - interval '30 days'`)
          )
        );
      return Number(value);
    },
    async contarOsAprovadas30d() {
      const [{ value }] = await db
        .select({ value: sql<number>`count(distinct t2.os_id)` })
        .from(sql`transicao_os t1`)
        .innerJoin(sql`transicao_os t2`, sql`t1.os_id = t2.os_id`)
        .where(
          sql`t1.estado_novo = 'ORCADA' and t1.em >= now() - interval '30 days' and t2.estado_novo = 'APROVADA' and t2.em >= t1.em`
        );
      return Number(value);
    },
    async contarOsConcluidas30d() {
      const [{ value }] = await db
        .select({ value: sql<number>`count(distinct ${transicaoOs.osId})` })
        .from(transicaoOs)
        .where(
          and(
            eq(transicaoOs.estadoNovo, "CONCLUIDA"),
            gte(transicaoOs.em, sql`now() - interval '30 days'`),
          ),
        );
      return Number(value);
    },
    async tempoMedioNovaPagaSegundos() {
      // Média do intervalo NOVA→PAGA: âncora NOVA = `ordemServico.criadoEm`
      // (toda OS nasce em estado NOVA — default da coluna `estado`), fim = 1ª
      // transição para PAGA. Só OS efetivamente pagas entram (inner join).
      const [{ value }] = await db
        .select({
          value: sql<
            string | null
          >`avg(extract(epoch from (paga.em - ${ordemServico.criadoEm})))`,
        })
        .from(ordemServico)
        .innerJoin(
          sql`(select os_id, min(em) as em from transicao_os where estado_novo = 'PAGA' group by os_id) paga`,
          sql`paga.os_id = ${ordemServico.id}`,
        );
      return value === null ? null : Number(value);
    },
    async contarOsPorEstado() {
      const linhas = await db
        .select({ estado: ordemServico.estado, total: count() })
        .from(ordemServico)
        .groupBy(ordemServico.estado);
      return linhas.map((l) => ({ estado: l.estado, total: Number(l.total) }));
    },
    async serieOsPorDia(dias: number) {
      // generate_series cobre TODOS os dias da janela (inclusive os sem OS),
      // evitando buracos na série; criadas (ordem_servico) e concluídas
      // (transicao→CONCLUIDA) são agregadas por dia e left-joinadas.
      const linhas = await db.execute(sql`
        select to_char(d.dia, 'YYYY-MM-DD') as dia,
               coalesce(c.criadas, 0)::int as criadas,
               coalesce(k.concluidas, 0)::int as concluidas
        from generate_series(
               date_trunc('day', now()) - ((${dias} - 1) * interval '1 day'),
               date_trunc('day', now()),
               interval '1 day'
             ) as d(dia)
        left join (
          select date_trunc('day', criado_em) as dd, count(*) as criadas
          from ordem_servico group by 1
        ) c on c.dd = d.dia
        left join (
          select date_trunc('day', em) as dd, count(distinct os_id) as concluidas
          from transicao_os where estado_novo = 'CONCLUIDA' group by 1
        ) k on k.dd = d.dia
        order by d.dia
      `);
      return (linhas.rows as { dia: string; criadas: number; concluidas: number }[]).map(
        (r) => ({ dia: r.dia, criadas: Number(r.criadas), concluidas: Number(r.concluidas) }),
      );
    },
    async obterNotaMediaGeral() {
      const [{ value }] = await db
        .select({ value: sql<string | null>`avg(${avaliacao.nota})` })
        .from(avaliacao)
        .where(eq(avaliacao.invalida, false));
      return value ? Number(value) : null;
    },
    async contarAlertasPendentes() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(alertaAvaliacao)
        .where(eq(alertaAvaliacao.status, "PENDENTE"));
      return Number(value);
    },
    listarNotasPorTecnico() {
      return criarNotaTecnicoRepoDrizzle(db).listarNotasPorTecnico();
    },
    async contarSubmissoes30d() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(solicitacao)
        .where(gte(solicitacao.criadoEm, sql`now() - interval '30 days'`));
      return Number(value);
    },
    async contarOrcamentosEnviados30d() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(orcamento)
        .where(gte(orcamento.criadoEm, sql`now() - interval '30 days'`));
      return Number(value);
    },
    async listarServicosMaisPedidos(limite: number) {
      const linhas = await db
        .select({
          servicoId: servico.id,
          nome: servico.nome,
          total: count(orcamentoItem.id),
        })
        .from(orcamentoItem)
        .innerJoin(servico, eq(servico.id, orcamentoItem.servicoId))
        .groupBy(servico.id, servico.nome)
        .orderBy(sql`count(${orcamentoItem.id}) desc`)
        .limit(limite);
      return linhas.map((l) => ({
        servicoId: l.servicoId,
        nome: l.nome,
        total: Number(l.total),
      }));
    },
    async remarketingAtivo() {
      const [row] = await db
        .select({ value: count() })
        .from(configRemarketing)
        .where(eq(configRemarketing.ativo, true));
      return Number(row?.value ?? 0) > 0;
    },
    async contarRemarketingEnviadoMes() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(remarketingEnviado)
        .where(gte(remarketingEnviado.criadoEm, sql`date_trunc('month', now())`));
      return Number(value);
    },
    async contarIndicacoesMes() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(indicacao)
        .where(gte(indicacao.criadoEm, sql`date_trunc('month', now())`));
      return Number(value);
    },
    async somarCreditosResgatadosMes() {
      // "Resgate" = crédito consumido (abatido de um pagamento) no mês corrente.
      const [{ value }] = await db
        .select({ value: sql<string | null>`sum(${creditoMovimentacao.valor})` })
        .from(creditoMovimentacao)
        .where(
          and(
            eq(creditoMovimentacao.tipo, "CONSUMIDO"),
            gte(creditoMovimentacao.criadoEm, sql`date_trunc('month', now())`),
          ),
        );
      return value ? Number(value).toFixed(2) : "0.00";
    },
    async contarChamadosGarantiaAbertos() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(garantiaChamado)
        .where(eq(garantiaChamado.status, "pendente"));
      return Number(value);
    },
    async contarChamadosGarantiaResolvidosNoMes() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(garantiaChamado)
        .where(
          and(
            inArray(garantiaChamado.status, ["aplicada", "rejeitada"]),
            gte(garantiaChamado.decididoEm, sql`date_trunc('month', now())`)
          )
        );
      return Number(value);
    },
    async contarChamadosGarantiaTotal() {
      const [{ value }] = await db.select({ value: count() }).from(garantiaChamado);
      return Number(value);
    },
    async contarOsPagaElegiveisGarantia() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(ordemServico)
        .where(
          and(
            eq(ordemServico.estado, "PAGA"),
            sql`${ordemServico.prazoGarantiaMeses} is not null`,
            sql`${ordemServico.prazoGarantiaMeses} > 0`,
          ),
        );
      return Number(value);
    },
    async contarGarantiasAtivas() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(ordemServico)
        .innerJoin(pagamento, and(eq(pagamento.osId, ordemServico.id), eq(pagamento.status, "approved")))
        .where(
          and(
            eq(ordemServico.estado, "PAGA"),
            sql`${ordemServico.prazoGarantiaMeses} is not null`,
            sql`${ordemServico.prazoGarantiaMeses} > 0`,
            sql`${pagamento.criadoEm} + (${ordemServico.prazoGarantiaMeses} * interval '1 month') > now()`
          )
        );
      return Number(value);
    },
    async listarAssinaturasAtivasComPreco() {
      return db
        .select({ preco: plano.preco })
        .from(assinatura)
        .innerJoin(plano, eq(plano.id, assinatura.planoId))
        .where(eq(assinatura.status, "ATIVA"));
    },
    async contarAssinaturasCanceladasNoMes() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(assinatura)
        .where(
          and(
            eq(assinatura.status, "CANCELADA"),
            gte(assinatura.canceladoEm, sql`date_trunc('month', now())`),
          ),
        );
      return Number(value);
    },
    async resumoFaturamento() {
      // Reaproveita o resumoPeriodo do módulo Financeiro (faturamento + ticket
      // médio), aplicado às janelas dia/semana/mês até agora.
      const financeiro = criarFinanceiroRepoDrizzle(db);
      const agora = new Date();
      const inicioDia = new Date(agora);
      inicioDia.setHours(0, 0, 0, 0);
      const inicioSemana = new Date(inicioDia);
      // Semana começa na segunda-feira (ISO): recua até o dia 1 (segunda).
      const diaSemana = (inicioSemana.getDay() + 6) % 7;
      inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const [dia, semana, mes] = await Promise.all([
        financeiro.resumoPeriodo({ inicio: inicioDia, fim: agora }),
        financeiro.resumoPeriodo({ inicio: inicioSemana, fim: agora }),
        financeiro.resumoPeriodo({ inicio: inicioMes, fim: agora }),
      ]);
      return { dia, semana, mes };
    },
    async contarAssinaturasAtivasInicioMes() {
      // Assinatura ativa no 1º instante do mês: iniciada antes do início do mês
      // e ainda não cancelada naquele momento (cancelada depois, ou nunca).
      const [{ value }] = await db
        .select({ value: count() })
        .from(assinatura)
        .where(
          sql`${assinatura.inicio} is not null
            and ${assinatura.inicio} < date_trunc('month', now())
            and (${assinatura.canceladoEm} is null
                 or ${assinatura.canceladoEm} >= date_trunc('month', now()))`,
        );
      return Number(value);
    },
    async contarInadimplenciaMais7Dias() {
      const [{ value }] = await db
        .select({ value: count() })
        .from(ordemServico)
        .leftJoin(
          pagamento,
          and(eq(pagamento.osId, ordemServico.id), eq(pagamento.status, "approved"))
        )
        .where(
          and(
            eq(ordemServico.estado, "CONCLUIDA"),
            isNull(pagamento.osId),
            sql`coalesce(
              (SELECT em FROM transicao_os WHERE os_id = ${ordemServico.id} AND estado_novo = 'CONCLUIDA' ORDER BY em DESC LIMIT 1),
              ${ordemServico.criadoEm}
            ) < now() - interval '7 days'`
          )
        );
      return Number(value);
    },
  };
}
