import { exigirGarantias } from "./guard";
import { db } from "@/db/client";
import { criarGarantiaDecisaoRepoDrizzle } from "@/operacao/garantia/garantia-decisao-repo-drizzle";
import GarantiasClientPage from "./client-page";

export const dynamic = "force-dynamic";

export default async function AdminGarantiasPage() {
  await exigirGarantias();

  const repo = criarGarantiaDecisaoRepoDrizzle(db);
  const chamados = await repo.listarChamadosPendentes();

  return <GarantiasClientPage chamados={chamados} />;
}
