import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { criarPagamentoCheckoutRepoDrizzle } from "@/pagamento/checkout-query-repo-drizzle";
import { montarCheckoutConsolidado } from "@/pagamento/checkout";
import { criarUpsellRepoDrizzle } from "@/financeiro/upsell/upsell-repo-drizzle";
import { carregarUpsellCheckout } from "@/financeiro/upsell/carregar-upsell-checkout";
import { SiteHeader } from "../../../_landing/site-header";
import { SiteFooter } from "../../../_landing/site-footer";
import { PagarView } from "./pagar-view";

export const metadata = {
  title: "Pagamento — DBG Elétrica e Pintura",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PagarPage({ params }: PageProps) {
  const { token } = await params;

  const repo = criarPagamentoCheckoutRepoDrizzle(db);
  const sol = await repo.carregarPorToken(token);

  if (!sol) {
    notFound();
  }

  const consolidado = montarCheckoutConsolidado(sol.ordens);
  const protocolo = token.slice(0, 8).toUpperCase();

  // Upsell (#65): só aparece se houver serviço pagável. Marca visto no render.
  const oferta = consolidado.podePagarTudo
    ? await carregarUpsellCheckout(
        { clienteId: sol.clienteId, somaPagavel: consolidado.somaPagavel },
        { repo: criarUpsellRepoDrizzle(db) },
      )
    : null;

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-2xl px-4 py-12 min-h-[70vh]">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-bold md:text-3xl tracking-tight">
            Pagamento — Solicitação #{protocolo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Olá, {sol.clienteNome.split(" ")[0]}. Selecione os serviços que deseja pagar ou pague tudo junto.
            {sol.cidade && ` · ${sol.cidade}/${sol.uf}`}
          </p>
        </div>

        <PagarView solicitacao={sol} consolidado={consolidado} upsell={oferta} />
      </main>
      <SiteFooter />
    </>
  );
}
