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
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { criarPortfolioRepoDrizzle } from "@/marketing/portfolio-repo-drizzle";
import { urlPublicaFoto } from "@/marketing/copiador-r2";
import { Equipe } from "./_landing/equipe";
import type { FotoPortfolioView } from "./_landing/portfolio";

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

async function carregarPortfolio(): Promise<FotoPortfolioView[]> {
  try {
    const fotos = await criarPortfolioRepoDrizzle(db).listarPublicas(12);
    return fotos.map((f) => ({
      id: f.id,
      url: urlPublicaFoto(f.chavePublica),
      categoria: f.categoria,
      tipo: f.tipo,
      tecnicoNome: f.tecnicoNome,
    }));
  } catch (err) {
    console.error("Erro ao carregar portfólio:", err);
    return [];
  }
}

export default async function Home() {
  const servicos = await carregarServicos();
  const portfolio = await carregarPortfolio();

  let tecnicos: import("@/equipe/membro-repo").Membro[] = [];
  try {
    const res = await criarMembroRepoDrizzle(db).listar({
      papel: "tecnico",
      ativo: true,
      limit: 100,
      offset: 0,
    });
    tecnicos = res.itens;
  } catch (err) {
    console.error("Erro ao carregar técnicos:", err);
  }
 
  return (
    <>
      <SiteHeader />
      <Hero />
      <ServicosGrid servicos={servicos} />
      <Portfolio fotos={portfolio} />
      <Equipe tecnicos={tecnicos} />
      <Avaliacoes />
      <SiteFooter />
    </>
  );
}
