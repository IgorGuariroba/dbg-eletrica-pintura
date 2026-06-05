import type { Dashboard } from "../dashboard";
import { KpiCard } from "./kpi-card";
import { RankingTecnicos } from "./ranking-tecnicos";

export function DashboardCards({ data }: { data: Dashboard }) {
  return (
    <div className="space-y-8">
      {/* 1. OPERACAO */}
      {data.operacao && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Operação</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="OS criadas hoje" value={data.operacao.criadasHoje} />
            <KpiCard label="OS novas na fila" value={data.operacao.novasNaFila} />
            <KpiCard label="Aguardando aprovação" value={data.operacao.aguardandoAprovacao} />
            <KpiCard
              label="Taxa de aprovação (30 dias)"
              value={
                data.operacao.taxaAprovacao?.pct != null
                  ? `${Math.round(data.operacao.taxaAprovacao.pct * 100)}%`
                  : "—"
              }
            />
          </div>
        </section>
      )}

      {/* 2. GARANTIAS */}
      {data.garantias && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Garantias</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Chamados abertos" value={data.garantias.chamadosAbertos} />
            <KpiCard label="Resolvidos no mês" value={data.garantias.resolvidosNoMes} />
            <KpiCard label="Garantias ativas" value={data.garantias.ativas} />
          </div>
        </section>
      )}

      {/* 3. MARKETING */}
      {data.marketing && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Marketing</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 h-fit">
              <KpiCard
                label="Nota média geral"
                value={
                  data.marketing.notaMediaGeral != null
                    ? data.marketing.notaMediaGeral.toFixed(1)
                    : "—"
                }
              />
              <KpiCard label="Alertas pendentes" value={data.marketing.alertasPendentes} />
            </div>
            <div className="lg:col-span-1">
              <RankingTecnicos ranking={data.marketing.ranking} />
            </div>
          </div>
        </section>
      )}

      {/* 4. FINANCEIRO */}
      {data.financeiro && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Financeiro</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Inadimplência > 7 dias"
              value={data.financeiro.inadimplenciaMais7Dias}
            />
          </div>
        </section>
      )}

      {/* 5. TECNICO */}
      {data.tecnico && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Minhas OS</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Atribuídas a mim" value={data.tecnico.atribuidasAMim} />
            <KpiCard label="Na minha fila" value={data.tecnico.minhaFila} />
          </div>
        </section>
      )}

      {/* 6. CATALOGO */}
      {data.catalogo && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Catálogo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Serviços ativos" value={data.catalogo.servicosAtivos} />
          </div>
        </section>
      )}

      {/* 7. EQUIPE */}
      {data.equipe && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Equipe</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Técnicos ativos" value={data.equipe.tecnicosAtivos} />
            <KpiCard label="Membros internos" value={data.equipe.membrosInternos} />
          </div>
        </section>
      )}
    </div>
  );
}
