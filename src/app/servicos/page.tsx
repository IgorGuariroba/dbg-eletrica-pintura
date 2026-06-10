import type { Metadata } from "next";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import type { Servico } from "@/catalogo/servico-repo";
import { SiteHeader } from "@/app/_landing/site-header";
import { SiteFooter } from "@/app/_landing/site-footer";
import { ServicosGrid } from "@/app/_landing/servicos-grid";
import { CtaFinal } from "@/app/_landing/cta-final";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Serviços e preços — DBG Elétrica e Pintura",
  description:
    "Catálogo completo de serviços de elétrica, pintura e drywall com preço fixo e garantia formal. O que você vê é o que paga.",
};

async function carregarServicos(): Promise<Servico[]> {
  try {
    const { itens } = await listarServicos(
      { ativo: true, perPage: 100 },
      criarServicoRepoDrizzle(db),
    );
    return itens;
  } catch {
    return [];
  }
}

export default async function ServicosPage() {
  const servicos = await carregarServicos();

  return (
    <>
      <SiteHeader />
      <ServicosGrid
        servicos={servicos}
        titulo="Serviços e preços"
        descricao="Catálogo completo, com preço fixo e garantia. Clique num serviço para ver detalhes e pedir orçamento."
      />
      <CtaFinal />
      <SiteFooter />
    </>
  );
}
