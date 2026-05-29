import { db } from "@/db/client";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { exigirOperacao } from "../guard";
import { ConfigForm } from "./config-form";

export default async function OperacaoConfigPage() {
  await exigirOperacao();
  const config = await criarOperacaoConfigRepoDrizzle(db).obter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração de Operação</h1>
        <p className="text-sm text-muted-foreground">
          Parâmetros de deslocamento usados na montagem de orçamentos.
        </p>
      </div>
      <ConfigForm config={config} />
    </div>
  );
}
