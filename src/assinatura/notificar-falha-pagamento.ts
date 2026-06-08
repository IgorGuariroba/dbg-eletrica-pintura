import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import {
  criarEmailService,
  renderizarEmailFalhaPagamento,
} from "@/notificacao/email-service";
import { enviarTemplate } from "@/notificacao/enviar-template";
import {
  criarTemplateRepo,
  normalizarWhatsapp,
  ordenarVariaveis,
} from "@/notificacao/templates";
import { whatsappConfigurado } from "@/notificacao/whatsapp-gateway";

/** Dados necessários para notificar o cliente sobre a falha de pagamento. */
export interface DadosFalhaPagamento {
  clienteNome: string;
  whatsapp: string | null;
  email: string | null;
  planoNome: string;
  /** URL do Mercado Pago para o cliente atualizar o método de pagamento. */
  linkAtualizacao: string;
}

export interface NotificarFalhaConfig {
  /** Carrega cliente + plano + link pela preapproval (default: Drizzle). */
  carregar?: (
    preapprovalIdMp: string,
  ) => Promise<DadosFalhaPagamento | undefined>;
  /** Envia o WhatsApp (default: template `assinatura_pagamento_falhou`). */
  enviarWhatsapp?: (input: {
    destinatario: string;
    clienteNome: string;
    link: string;
  }) => Promise<void>;
  /** Envia o e-mail (default: Resend via EmailService). */
  enviarEmail?: (input: {
    para: string;
    assunto: string;
    html: string;
  }) => Promise<void>;
  /** Força o mock do Resend (testes/local). */
  forceMock?: boolean;
}

export interface NotificarFalhaResultado {
  whatsapp: "sent" | "skipped";
  email: "sent" | "skipped";
}

/**
 * Notifica o cliente que a cobrança da assinatura falhou (slice #58): dispara
 * WhatsApp + e-mail com o link de atualização do método de pagamento no MP.
 * Cliente sem WhatsApp/e-mail → pula o canal sem lançar (mesmo contrato do
 * notificador de OS). A idempotência (1 falha = 1 notificação) é garantida a
 * montante por `assinatura_evento` no webhook.
 */
export async function notificarFalhaPagamento(
  preapprovalIdMp: string,
  config: NotificarFalhaConfig = {},
): Promise<NotificarFalhaResultado> {
  const carregar = config.carregar ?? carregarDadosDrizzle;
  const dados = await carregar(preapprovalIdMp);
  if (!dados) return { whatsapp: "skipped", email: "skipped" };

  const resultado: NotificarFalhaResultado = {
    whatsapp: "skipped",
    email: "skipped",
  };

  const destinatario = dados.whatsapp
    ? normalizarWhatsapp(dados.whatsapp)
    : null;
  if (destinatario) {
    const enviar = config.enviarWhatsapp ?? enviarWhatsappPadrao;
    await enviar({
      destinatario,
      clienteNome: dados.clienteNome,
      link: dados.linkAtualizacao,
    });
    resultado.whatsapp = "sent";
  } else {
    console.log(
      `[falha-pagamento] whatsapp_skipped: cliente ${dados.clienteNome} sem WhatsApp válido.`,
    );
  }

  if (dados.email) {
    const html = await renderizarEmailFalhaPagamento({
      clienteNome: dados.clienteNome,
      planoNome: dados.planoNome,
      linkAtualizacao: dados.linkAtualizacao,
    });
    const enviar =
      config.enviarEmail ??
      ((input) =>
        criarEmailService({ forceMock: config.forceMock })
          .enviar(input)
          .then(() => undefined));
    await enviar({
      para: dados.email,
      assunto: "Falha no pagamento da sua assinatura — DBG Elétrica e Pintura",
      html,
    });
    resultado.email = "sent";
  } else {
    console.log(
      `[falha-pagamento] email_skipped: cliente ${dados.clienteNome} sem e-mail.`,
    );
  }

  return resultado;
}

/** WhatsApp default: monta as variáveis do catálogo e dispara o template. */
async function enviarWhatsappPadrao(input: {
  destinatario: string;
  clienteNome: string;
  link: string;
}): Promise<void> {
  if (!whatsappConfigurado()) {
    console.log("[falha-pagamento] whatsapp_skipped: Cloud API não configurada.");
    return;
  }
  const padrao = await criarTemplateRepo().obterVariaveis(
    "assinatura_pagamento_falhou",
  );
  await enviarTemplate({
    destinatario: input.destinatario,
    template: "assinatura_pagamento_falhou",
    variaveis: ordenarVariaveis("assinatura_pagamento_falhou", {
      ...padrao,
      nome_cliente: input.clienteNome,
      link: input.link,
    }),
  });
}

/** Loader default: cliente + plano pela preapproval, link MP de gestão. */
async function carregarDadosDrizzle(
  preapprovalIdMp: string,
): Promise<DadosFalhaPagamento | undefined> {
  const [row] = await db
    .select({
      clienteNome: cliente.nome,
      whatsapp: cliente.whatsapp,
      email: cliente.email,
      planoNome: plano.nome,
    })
    .from(assinatura)
    .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
    .innerJoin(plano, eq(assinatura.planoId, plano.id))
    .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp))
    .limit(1);
  if (!row) return undefined;

  const baseMp =
    process.env.MP_SUBSCRIPTION_MANAGE_URL ??
    "https://www.mercadopago.com.br/subscriptions";
  return {
    clienteNome: row.clienteNome,
    whatsapp: row.whatsapp,
    email: row.email,
    planoNome: row.planoNome,
    linkAtualizacao: `${baseMp}/${preapprovalIdMp}`,
  };
}
