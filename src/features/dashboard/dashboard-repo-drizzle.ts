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
} from "@/db/schema";
import type { Categoria } from "@/operacao/fila-repo";
import type { DashboardRepo } from "./dashboard";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";

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
    contarTecnicosAtivos() {
      return contar(membro, and(eq(membro.isTecnico, true), eq(membro.ativo, true)));
    },
    contarMembrosInternos() {
      return contar(membro, and(possuiModulo, eq(membro.ativo, true)));
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
      // Média do intervalo entre a criação da OS e a 1ª transição para PAGA.
      // Só OS efetivamente pagas entram na conta (inner join implícito).
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
