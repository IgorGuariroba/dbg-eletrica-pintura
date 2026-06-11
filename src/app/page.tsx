import type { Metadata } from "next";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import type { Servico } from "@/catalogo/servico-repo";
import { Hero } from "./_landing/hero";
import { Diferenciais } from "./_landing/diferenciais";
import { ComoFunciona } from "./_landing/como-funciona";
import { ServicosGrid } from "./_landing/servicos-grid";
import { Portfolio } from "./_landing/portfolio";
import { Avaliacoes } from "./_landing/avaliacoes";
import { CtaFinal } from "./_landing/cta-final";
import { SiteHeader } from "./_landing/site-header";
import { SiteFooter } from "./_landing/site-footer";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { criarPortfolioRepoDrizzle } from "@/marketing/portfolio-repo-drizzle";
import { criarDepoimentosQueryDrizzle } from "@/marketing/landing/depoimentos-query-drizzle";
import { criarMetricasPublicasQueryDrizzle } from "@/marketing/landing/metricas-publicas-query-drizzle";
import type { MetricasPublicas } from "@/marketing/landing/metricas-publicas-query";
import type { DepoimentoCandidato } from "@/marketing/landing/depoimentos-query";
import { listarBairrosAtendidos } from "@/operacao/cobertura-query";
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

async function carregarDepoimentos(): Promise<DepoimentoCandidato[]> {
  try {
    return await criarDepoimentosQueryDrizzle(db).listarCandidatos(10);
  } catch (err) {
    console.error("Erro ao carregar depoimentos:", err);
    return [];
  }
}

async function carregarMetricas(): Promise<MetricasPublicas> {
  try {
    return await criarMetricasPublicasQueryDrizzle(db).obter();
  } catch (err) {
    console.error("Erro ao carregar métricas públicas:", err);
    return { osConcluidas: 0, notaMedia: null, totalAvaliacoes: 0 };
  }
}

async function carregarBairros(): Promise<string[]> {
  try {
    return await listarBairrosAtendidos();
  } catch (err) {
    console.error("Erro ao carregar bairros atendidos:", err);
    return [];
  }
}

export default async function Home() {
  const [servicos, portfolio, depoimentos, metricas, bairros] =
    await Promise.all([
      carregarServicos(),
      carregarPortfolio(),
      carregarDepoimentos(),
      carregarMetricas(),
      carregarBairros(),
    ]);

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
      <Hero bairros={bairros} metricas={metricas} />
      <Diferenciais metricas={metricas} />
      <Portfolio fotos={portfolio} limite={6} />
      <ServicosGrid servicos={servicos} limitePorCategoria={3} />
      <ComoFunciona />
      <Equipe tecnicos={tecnicos} compacta />
      <Avaliacoes depoimentos={depoimentos} />
      <CtaFinal />
      <SiteFooter bairros={bairros} />
    </>
  );
}
