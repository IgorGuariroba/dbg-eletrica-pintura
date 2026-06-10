import type { Dashboard } from "../dashboard";
import { KpiCard } from "./kpi-card";
import { RankingTecnicos } from "./ranking-tecnicos";
import { FunilBars } from "./funil-bars";
import { ListaDashboard } from "./lista-dashboard";

function pct(valor: number | null): string {
  return valor != null ? `${Math.round(valor * 100)}%` : "—";
}

function dinheiro(valor: string): string {
  return `R$ ${valor}`;
}

// Tempo médio em segundos → forma legível (dias/horas/minutos).
function duracao(segundos: number | null): string {
  if (segundos == null) return "—";
  if (segundos >= 86400) return `${(segundos / 86400).toFixed(1)} d`;
  if (segundos >= 3600) return `${(segundos / 3600).toFixed(1)} h`;
  return `${Math.round(segundos / 60)} min`;
}

const CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export function DashboardCards({ data }: { data: Dashboard }) {
  return (
    <div className="space-y-12">
      {/* 1. OPERACAO */}
      {data.operacao && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Operação</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="OS criadas hoje" value={data.operacao.criadasHoje} />
            <KpiCard label="OS novas na fila" value={data.operacao.novasNaFila} />
            <KpiCard label="Aguardando aprovação" value={data.operacao.aguardandoAprovacao} />
            <KpiCard
              label="Tempo médio NOVA → PAGA"
              value={duracao(data.operacao.tempoMedioNovaPagaSegundos)}
            />
            <KpiCard
              label="Taxa de aprovação (30 dias)"
              value={pct(data.operacao.taxaAprovacao?.pct ?? null)}
            />
            <KpiCard
              label="Taxa de conclusão (30 dias)"
              value={pct(data.operacao.taxaConclusao?.pct ?? null)}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListaDashboard
              titulo="OS por estado"
              descricao="Distribuição atual da operação"
              max={20}
              itens={data.operacao.funilEstados.map((e) => ({
                chave: e.estado,
                label: e.estado,
                valor: e.total,
              }))}
              vazio="Nenhuma OS registrada."
            />
            <ListaDashboard
              titulo="Criadas vs concluídas (14 dias)"
              max={14}
              itens={data.operacao.serie.map((d) => ({
                chave: d.dia,
                label: d.dia,
                valor: `${d.criadas} / ${d.concluidas}`,
              }))}
              vazio="Sem movimentação no período."
            />
          </div>
        </section>
      )}

      {/* 2. FINANCEIRO */}
      {data.financeiro && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Financeiro</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="MRR" value={dinheiro(data.financeiro.mrr)} />
            <KpiCard
              label="Faturamento (mês)"
              value={dinheiro(data.financeiro.faturamento.mes.faturamento)}
            />
            <KpiCard
              label="Ticket médio (mês)"
              value={dinheiro(data.financeiro.faturamento.mes.ticketMedio)}
            />
            <KpiCard label="Churn mensal" value={pct(data.financeiro.churn.pct)} />
            <KpiCard
              label="Faturamento (hoje)"
              value={dinheiro(data.financeiro.faturamento.dia.faturamento)}
            />
            <KpiCard
              label="Faturamento (semana)"
              value={dinheiro(data.financeiro.faturamento.semana.faturamento)}
            />
            <KpiCard
              label="Inadimplência > 7 dias"
              value={data.financeiro.inadimplenciaMais7Dias}
            />
          </div>
        </section>
      )}

      {/* 3. MARKETING */}
      {data.marketing && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Marketing</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Nota média geral"
              value={
                data.marketing.notaMediaGeral != null
                  ? data.marketing.notaMediaGeral.toFixed(1)
                  : "—"
              }
            />
            <KpiCard label="Alertas pendentes" value={data.marketing.alertasPendentes} />
            <KpiCard label="Indicações (mês)" value={data.marketing.indicacoesMes} />
            <KpiCard
              label="Créditos resgatados (mês)"
              value={dinheiro(data.marketing.creditosResgatadosMes)}
            />
            <KpiCard
              label="Remarketing"
              value={data.marketing.remarketing.ativo ? "Ativo" : "Inativo"}
            />
            <KpiCard
              label="Envios de remarketing (mês)"
              value={data.marketing.remarketing.enviadosMes}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <FunilBars estagios={data.marketing.funil} />
            </div>
            <div className="lg:col-span-1">
              <ListaDashboard
                titulo="Serviços mais pedidos"
                itens={data.marketing.servicosMaisPedidos.map((s) => ({
                  chave: s.servicoId,
                  label: s.nome,
                  valor: s.total,
                }))}
                vazio="Nenhum serviço pedido ainda."
              />
            </div>
            <div className="lg:col-span-1">
              <RankingTecnicos ranking={data.marketing.ranking} />
            </div>
          </div>
        </section>
      )}

      {/* 4. EQUIPE */}
      {data.equipe && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Equipe</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Técnicos ativos" value={data.equipe.tecnicosAtivos} />
            <KpiCard label="Membros internos" value={data.equipe.membrosInternos} />
            <KpiCard label="Técnicos ociosos" value={data.equipe.ociosos.length} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListaDashboard
              titulo="OS por técnico (mês)"
              itens={data.equipe.osPorTecnicoMes.map((t) => ({
                chave: t.tecnicoId,
                label: t.nome,
                valor: t.total,
              }))}
              vazio="Nenhuma OS atribuída no mês."
            />
            <ListaDashboard
              titulo="Técnicos ociosos"
              descricao="Sem OS atribuída há 7 dias ou mais"
              itens={data.equipe.ociosos.map((t) => ({
                chave: t.tecnicoId,
                label: t.nome,
              }))}
              vazio="Nenhum técnico ocioso."
            />
          </div>
        </section>
      )}

      {/* 5. GARANTIAS */}
      {data.garantias && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Garantias</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Chamados abertos" value={data.garantias.chamadosAbertos} />
            <KpiCard label="Resolvidos no mês" value={data.garantias.resolvidosNoMes} />
            <KpiCard label="Garantias ativas" value={data.garantias.ativas} />
            <KpiCard
              label="Taxa de acionamento"
              value={pct(data.garantias.taxaAcionamento.pct)}
            />
          </div>
        </section>
      )}

      {/* 6. CATALOGO */}
      {data.catalogo && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Catálogo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Serviços ativos" value={data.catalogo.servicosAtivos} />
            <KpiCard label="Sem demanda (90 dias)" value={data.catalogo.semDemanda.length} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ListaDashboard
              titulo="Serviços mais pedidos"
              itens={data.catalogo.maisPedidos.map((s) => ({
                chave: s.servicoId,
                label: s.nome,
                valor: s.total,
              }))}
              vazio="Nenhum serviço pedido ainda."
            />
            <ListaDashboard
              titulo="Sem demanda (90 dias)"
              itens={data.catalogo.semDemanda.map((s) => ({
                chave: s.servicoId,
                label: s.nome,
              }))}
              vazio="Todos os serviços tiveram demanda."
            />
            <ListaDashboard
              titulo="Preço médio por categoria"
              itens={data.catalogo.precoMedioPorCategoria.map((p) => ({
                chave: p.categoria,
                label: CATEGORIA[p.categoria] ?? p.categoria,
                valor: dinheiro(p.precoMedio),
              }))}
              vazio="Sem serviços cadastrados."
            />
          </div>
        </section>
      )}

      {/* 7. TECNICO */}
      {data.tecnico && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Minhas OS</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Atribuídas a mim" value={data.tecnico.atribuidasAMim} />
            <KpiCard label="Na minha fila" value={data.tecnico.minhaFila} />
          </div>
        </section>
      )}
    </div>
  );
}
