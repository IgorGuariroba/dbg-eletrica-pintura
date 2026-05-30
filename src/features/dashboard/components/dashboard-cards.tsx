import type { Dashboard } from "../dashboard";
import { KpiCard } from "./kpi-card";

interface Secao {
  titulo: string;
  kpis: { label: string; value: number }[];
}

function montarSecoes(data: Dashboard): Secao[] {
  const secoes: Secao[] = [];

  if (data.operacao) {
    secoes.push({
      titulo: "Operação",
      kpis: [
        { label: "OS criadas hoje", value: data.operacao.criadasHoje },
        { label: "OS novas na fila", value: data.operacao.novasNaFila },
        { label: "Aguardando aprovação", value: data.operacao.aguardandoAprovacao },
      ],
    });
  }
  if (data.tecnico) {
    secoes.push({
      titulo: "Minhas OS",
      kpis: [
        { label: "Atribuídas a mim", value: data.tecnico.atribuidasAMim },
        { label: "Na minha fila", value: data.tecnico.minhaFila },
      ],
    });
  }
  if (data.catalogo) {
    secoes.push({
      titulo: "Catálogo",
      kpis: [{ label: "Serviços ativos", value: data.catalogo.servicosAtivos }],
    });
  }
  if (data.equipe) {
    secoes.push({
      titulo: "Equipe",
      kpis: [
        { label: "Técnicos ativos", value: data.equipe.tecnicosAtivos },
        { label: "Membros internos", value: data.equipe.membrosInternos },
      ],
    });
  }

  return secoes;
}

export function DashboardCards({ data }: { data: Dashboard }) {
  const secoes = montarSecoes(data);

  return (
    <div className="space-y-8">
      {secoes.map((secao) => (
        <section key={secao.titulo} className="space-y-4">
          <h2 className="text-lg font-semibold">{secao.titulo}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {secao.kpis.map((kpi) => (
              <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
