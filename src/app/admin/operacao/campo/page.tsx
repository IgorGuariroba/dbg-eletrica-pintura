import { db } from "@/db/client";
import { criarCampoRepoDrizzle } from "@/operacao/campo-repo-drizzle";
import { listarTecnicosEmCampo } from "@/operacao/campo";
import { exigirOperacao } from "../guard";
import { CampoDashboard } from "./campo-dashboard";

export default async function CampoPage() {
  await exigirOperacao();

  const repo = criarCampoRepoDrizzle(db);
  const tecnicos = await listarTecnicosEmCampo(repo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Técnicos em Campo</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento em tempo real das OS em execução. Atualização
          automática a cada 30 segundos.
        </p>
      </div>
      <CampoDashboard tecnicosIniciais={tecnicos} />
    </div>
  );
}
