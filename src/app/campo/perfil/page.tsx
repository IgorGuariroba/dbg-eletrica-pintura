import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { exigirTecnico } from "../guard";

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export default async function CampoPerfilPage() {
  const { nome, especialidades } = await exigirTecnico();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Perfil</h1>
      <Card>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Técnico</p>
            <p className="text-base font-semibold">{nome ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Especialidades</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {especialidades.length ? (
                especialidades.map((e) => (
                  <Badge key={e} variant="outline">
                    {CATEGORIA_LABEL[e] ?? e}
                  </Badge>
                ))
              ) : (
                <span className="text-base">—</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
