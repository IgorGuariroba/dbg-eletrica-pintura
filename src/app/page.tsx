import type { Metadata } from "next";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import type { Servico } from "@/catalogo/servico-repo";
import { Hero } from "./_landing/hero";
import { ServicosGrid } from "./_landing/servicos-grid";
import { Portfolio } from "./_landing/portfolio";
import { Avaliacoes } from "./_landing/avaliacoes";
import { SiteHeader } from "./_landing/site-header";
import { SiteFooter } from "./_landing/site-footer";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "DBG Elétrica e Pintura — Preço fixo, garantia e agendamento digital",
  description:
    "Serviços residenciais de elétrica, pintura e drywall com preço fixo, garantia formal e fotos antes/depois. Solicite seu orçamento online.",
  openGraph: {
    title: "DBG Elétrica e Pintura",
    description:
      "Preço fixo. Garantia. Agendamento digital. Sem surpresa no final.",
    type: "website",
    locale: "pt_BR",
  },
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

export default async function Home() {
  const servicos = await carregarServicos();

  return (
    <>
      <SiteHeader />
      <Hero />
      <ServicosGrid servicos={servicos} />
      <Portfolio />
      <Avaliacoes />
      <SiteFooter />
    </>
  );
}
