import { db } from "@/db/client";
import { montarDashboardCacheado } from "@/features/dashboard/dashboard-cacheado";
import { criarDashboardRepoDrizzle } from "@/features/dashboard/dashboard-repo-drizzle";
import { DashboardCards } from "@/features/dashboard/components/dashboard-cards";
import { exigirFila } from "./guard";

export default async function PainelPage() {
  const { usuario, nome } = await exigirFila();
  const dashboard = await montarDashboardCacheado(
    usuario,
    criarDashboardRepoDrizzle(db),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Painel</h1>
        {nome ? (
          <p className="text-sm text-muted-foreground">Bem-vindo, {nome}.</p>
        ) : null}
      </header>
      <DashboardCards data={dashboard} />
    </div>
  );
}
