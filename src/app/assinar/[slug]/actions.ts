"use server";

import { db } from "@/db/client";
import { exigirPortal } from "@/portal/guard";
import { criarAssinaturaRepoDrizzle } from "@/assinatura/assinatura-repo-drizzle";
import { criarClienteAssinaturaRepoDrizzle } from "@/assinatura/cliente-assinatura-repo-drizzle";
import { criarGatewayMercadoPagoAssinatura } from "@/assinatura/mercadopago-assinatura";
import {
  iniciarAssinaturaPlano,
  type IniciarAssinaturaResultado,
} from "@/assinatura/iniciar-assinatura-plano";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";

export type AssinarResultado =
  | { ok: true; initPoint: string }
  | { ok: false; erro: string };

const MENSAGEM_ERRO: Record<
  Exclude<IniciarAssinaturaResultado, { ok: true }>["erro"],
  string
> = {
  PLANO_NAO_ENCONTRADO: "Plano não encontrado.",
  PLANO_INDISPONIVEL: "Este plano não está disponível para assinatura no momento.",
  JA_ASSINANTE: "Você já possui uma assinatura ativa deste plano.",
};

/**
 * Inicia a assinatura digital de um plano pelo slug. Exige sessão de cliente
 * com WhatsApp vinculado (exigirPortal redireciona para login/vinculação caso
 * contrário). Devolve o initPoint do MP para o cliente autorizar a cobrança no
 * próprio dispositivo.
 */
export async function assinarPlanoAction(
  slug: string,
): Promise<AssinarResultado> {
  const user = await exigirPortal();

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    return { ok: false, erro: "Configuração de URL ausente. Tente novamente." };
  }

  const res = await iniciarAssinaturaPlano(
    {
      slug,
      cliente: {
        nome: user.name ?? "Cliente",
        whatsapp: user.whatsapp!,
        email: user.email!,
      },
      backUrl: `${site}/portal?assinatura=ok`,
    },
    {
      planoRepo: criarPlanoRepoDrizzle(db),
      clienteRepo: criarClienteAssinaturaRepoDrizzle(db),
      gateway: criarGatewayMercadoPagoAssinatura(),
      assinaturaRepo: criarAssinaturaRepoDrizzle(db),
    },
  );

  if (!res.ok) {
    return { ok: false, erro: MENSAGEM_ERRO[res.erro] };
  }
  return { ok: true, initPoint: res.initPoint };
}
