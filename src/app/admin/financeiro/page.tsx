import { db } from "@/db/client";
import { criarFinanceiroRepoDrizzle } from "@/features/financeiro/financeiro-repo-drizzle";
import { intervaloPeriodo } from "@/features/financeiro/periodo";
import { exigirFinanceiro } from "./guard";
import { ResumoCards } from "@/features/financeiro/components/resumo-cards";
import { PendentesLista } from "@/features/financeiro/components/pendentes-lista";
import { ConfirmadosLista } from "@/features/financeiro/components/confirmados-lista";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import type { Periodo } from "@/features/financeiro/financeiro";

type SP = { periodo?: string };

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // 1. Verificar permissões
  await exigirFinanceiro();

  // 2. Extrair parâmetros e calcular período
  const sp = await searchParams;
  const periodoInput = sp.periodo;
  const periodo: Periodo =
    periodoInput === "dia" || periodoInput === "semana" || periodoInput === "mes"
      ? periodoInput
      : "mes";

  // 3. Inicializar repositório e buscar dados
  const repo = criarFinanceiroRepoDrizzle(db);
  const agora = new Date();
  const intervalo = intervaloPeriodo(periodo, agora);

  const [pendentes, confirmados, resumo] = await Promise.all([
    repo.listarPendentes(),
    repo.listarConfirmados(intervalo),
    repo.resumoPeriodo(intervalo),
  ]);

  // Obter a URL base da aplicação para os links de pagamento do WhatsApp
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <div className="space-y-8 flex flex-col min-w-0 w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Painel Financeiro
          </h2>
          <p className="text-muted-foreground text-sm">
            Gerencie o faturamento, controle ordens de serviço pendentes e envie lembretes de pagamento.
          </p>
        </div>

        {/* Abas / Filtro de Período */}
        <Tabs defaultValue={periodo} value={periodo} className="w-fit">
          <TabsList>
            <TabsTrigger value="dia" nativeButton={false} render={<Link href="?periodo=dia" />}>
              Hoje
            </TabsTrigger>
            <TabsTrigger value="semana" nativeButton={false} render={<Link href="?periodo=semana" />}>
              Esta Semana
            </TabsTrigger>
            <TabsTrigger value="mes" nativeButton={false} render={<Link href="?periodo=mes" />}>
              Este Mês
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Cartões de Resumo */}
      <ResumoCards resumo={resumo} />

      {/* Lista de Pendentes */}
      <PendentesLista pendentes={pendentes} siteUrl={siteUrl} />

      {/* Lista de Confirmados */}
      <ConfirmadosLista confirmados={confirmados} />
    </div>
  );
}
