import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunilEstagio } from "../calculos";

const ROTULO: Record<FunilEstagio["nome"], string> = {
  submissoes: "Submissões",
  orcados: "Orçados",
  aprovados: "Aprovados",
  concluidos: "Concluídos",
};

export function FunilBars({ estagios }: { estagios: FunilEstagio[] }) {
  const maxTotal = Math.max(1, ...estagios.map((e) => e.total));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Funil de conversão (30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {estagios.map((estagio) => (
          <div key={estagio.nome} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {ROTULO[estagio.nome]}
              </span>
              <span className="tabular-nums font-semibold text-foreground">
                {estagio.total}
                {estagio.conversao != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {Math.round(estagio.conversao * 100)}%
                  </span>
                )}
              </span>
            </div>
            {/* Largura proporcional ao topo do funil — valor calculado em runtime. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(estagio.total / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
