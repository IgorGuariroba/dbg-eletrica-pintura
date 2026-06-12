import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarLandingOverrideRepoDrizzle } from "@/marketing/landing/landing-override-repo-drizzle";
import { criarDepoimentosQueryDrizzle } from "@/marketing/landing/depoimentos-query-drizzle";
import {
  montarLanding,
  type DepoimentoLanding,
  type UpsellLanding,
} from "@/marketing/landing/montar-landing";
import { urlPublicaFoto } from "@/lib/storage";
import { listarBairrosAtendidos } from "@/operacao/cobertura-query";
import { SiteHeader } from "@/app/_landing/site-header";
import { SiteFooter } from "@/app/_landing/site-footer";
import { LandingServico } from "./landing-servico";

// SSG com revalidação por ISR. A revalidação imediata ao salvar um override
// acontece via revalidatePath("/servicos/{slug}") na server action do admin.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { itens } = await listarServicos(
      { ativo: true, perPage: 100 },
      criarServicoRepoDrizzle(db),
    );
    return itens
      .filter((s) => s.slug)
      .map((s) => ({ slug: s.slug as string }));
  } catch {
    return [];
  }
}

async function carregar(slug: string) {
  const servicoRepo = criarServicoRepoDrizzle(db);
  const servico = await servicoRepo.buscarPorSlug(slug);
  if (!servico || !servico.ativo) return null;

  const overrideRepo = criarLandingOverrideRepoDrizzle(db);
  const override = await overrideRepo.obterPorServico(servico.id);

  const fotosExtras = (override?.fotos ?? []).map((f) =>
    urlPublicaFoto(f.chave),
  );

  let upsell: UpsellLanding | null = null;
  if (override?.upsellServicoId) {
    const u = await servicoRepo.buscarPorId(override.upsellServicoId);
    if (u && u.ativo && u.slug) {
      upsell = { slug: u.slug, titulo: u.nome };
    }
  }

  let depoimentos: DepoimentoLanding[] = [];
  if (override?.depoimentoIds.length) {
    depoimentos = await criarDepoimentosQueryDrizzle(db).porIds(
      override.depoimentoIds,
    );
  }

  const view = montarLanding({
    servico: {
      slug: servico.slug as string,
      nome: servico.nome,
      categoria: servico.categoria,
      precoBase: servico.precoBase,
      fotoUrl: servico.fotoUrl,
    },
    override: override
      ? {
          titulo: override.titulo,
          descricao: override.descricao,
          precoPromo: override.precoPromo,
        }
      : null,
    fotosExtras,
    upsell,
    depoimentos,
  });

  return view;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await carregar(slug);
  if (!view) return { title: "Serviço não encontrado — DBG" };
  return {
    title: `${view.titulo} — DBG Elétrica e Pintura`,
    description: view.descricao,
    openGraph: {
      title: view.titulo,
      description: view.descricao,
      type: "website",
      locale: "pt_BR",
      images: view.fotos.length ? [view.fotos[0]] : undefined,
    },
  };
}

export default async function ServicoLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await carregar(slug);
  if (!view) notFound();

  const bairrosAtendidos = await listarBairrosAtendidos();

  return (
    <>
      <SiteHeader />
      <LandingServico view={view} bairrosAtendidos={bairrosAtendidos} />
      <SiteFooter />
    </>
  );
}
