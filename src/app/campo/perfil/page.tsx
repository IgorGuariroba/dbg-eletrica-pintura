import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { DisponibilidadeForm } from "@/features/operacao/components/disponibilidade-form";
import { exigirTecnico } from "../guard";

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export default async function CampoPerfilPage() {
  const { membroId, nome, especialidades } = await exigirTecnico();
  const membro = await criarMembroRepoDrizzle(db).buscarPorId(membroId);

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

      <Card>
        <CardHeader>
          <CardTitle>Minha disponibilidade</CardTitle>
          <CardDescription>
            Restrinja seus horários dentro do horário comercial da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DisponibilidadeForm
            tecnicoId={membroId}
            disponibilidade={membro?.disponibilidade ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
