import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotaTecnicoView } from "@/marketing/nota-tecnico-repo";

export interface RankingTecnicosProps {
  ranking: NotaTecnicoView[];
}

export function RankingTecnicos({ ranking }: RankingTecnicosProps) {
  if (ranking.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ranking de Técnicos</CardTitle>
          <CardDescription>Média de avaliações válidas (mín. 5)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum técnico qualificado para o ranking ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ranking de Técnicos</CardTitle>
        <CardDescription>Técnicos com melhor avaliação (mín. 5 válidas)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {ranking.map((item, index) => (
            <div
              key={item.tecnicoId}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {item.tecnicoNome || "Técnico sem nome"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  {item.media != null ? item.media.toFixed(1) : "—"}
                  <span className="text-amber-500">★</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.total} {item.total === 1 ? "avaliação" : "avaliações"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
