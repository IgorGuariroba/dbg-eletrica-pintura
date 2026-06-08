"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { gerarQrDataUrl } from "@/lib/qr";
import { urlWhatsApp } from "@/lib/contato";

export type EnviarAssinaturaResultado =
  | { ok: true; urlLanding: string; qrDataUrl: string; urlWaMe: string }
  | { ok: false; erro: string };

/**
 * Gera o material para o cliente assinar um plano presencialmente, ao fim de uma
 * OS concluída: QR + link wa.me apontando para a landing /assinar/{slug}?os={id}.
 * O cliente paga no próprio dispositivo (auth Google + checkout MP) — o técnico
 * nunca captura dados financeiros. Exige técnico autenticado e OS CONCLUIDA.
 */
export async function enviarAssinaturaAction(
  osId: string,
  slug: string,
): Promise<EnviarAssinaturaResultado> {
  try {
    await exigirTecnico();
  } catch {
    return { ok: false, erro: "Apenas técnicos autenticados." };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    return { ok: false, erro: "Configuração de URL ausente." };
  }

  const [os] = await db
    .select({ estado: ordemServico.estado })
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);
  if (!os) return { ok: false, erro: "Ordem de serviço não encontrada." };
  if (os.estado !== "CONCLUIDA") {
    return {
      ok: false,
      erro: "A assinatura só pode ser oferecida em OS concluída.",
    };
  }

  const plano = await criarPlanoRepoDrizzle(db).buscarPorSlug(slug);
  if (!plano || !plano.ativo) {
    return { ok: false, erro: "Plano indisponível." };
  }

  const urlLanding = `${site}/assinar/${plano.slug}?os=${osId}`;
  const qrDataUrl = await gerarQrDataUrl(urlLanding);
  const urlWaMe = urlWhatsApp(
    `Olá! Para assinar o plano ${plano.nome} da DBG, acesse: ${urlLanding}`,
  );

  return { ok: true, urlLanding, qrDataUrl, urlWaMe };
}
