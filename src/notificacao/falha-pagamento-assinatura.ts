import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type { DespachoWhatsapp } from "./dispatcher";
import {
  criarEmailService,
  renderizarEmailFalhaPagamento,
  type EmailService,
} from "./email-service";
import { enviarTemplate } from "./enviar-template";
import { claimMarco } from "./marco";
import type { NotificacaoResultado } from "./notificador";
import {
  criarTemplateRepo,
  normalizarWhatsapp,
  ordenarVariaveis,
} from "./templates";
import { whatsappConfigurado, type GatewayWhatsApp } from "./whatsapp-gateway";

export interface FalhaPagamentoResultado {
  whatsapp: DespachoWhatsapp;
  email: NotificacaoResultado;
}

/**
 * Falha de pagamento de assinatura (evento `assinatura.pagamento_falhou`):
 * WhatsApp (template `assinatura_pagamento_falhou`, com Horário Restrito/fila)
 * + e-mail, ambos com o link de atualização do método de pagamento no MP.
 * Prioridade de Canal: WhatsApp para ação imediata + e-mail.
 *
 * Idempotência em duas camadas: dedup por `assinatura_evento` no webhook a
 * montante (ADR-0006) e Marco de Notificação (assinaturaId,
 * `pagamento_falhou:{eventId}`) — por evento, para que reexecução do mesmo
 * webhook não reenvie sem bloquear falhas legítimas de ciclos futuros.
 * Cliente sem WhatsApp/e-mail → pula o canal e loga, sem lançar.
 */
export async function notificarFalhaPagamentoAssinatura(
  evento: {
    tipo: "assinatura.pagamento_falhou";
    preapprovalIdMp: string;
    eventId: string;
  },
  deps: { whatsapp?: GatewayWhatsApp; email?: EmailService; agora?: Date } = {},
): Promise<FalhaPagamentoResultado> {
  const dados = await carregarDados(evento.preapprovalIdMp);
  if (!dados) {
    return {
      whatsapp: { status: "skipped", motivo: "assinatura não encontrada" },
      email: { status: "skipped", motivo: "assinatura não encontrada" },
    };
  }

  // Reivindica o marco ANTES de enviar: reexecução do mesmo webhook não reenvia.
  if (!(await claimMarco(dados.assinaturaId, `pagamento_falhou:${evento.eventId}`))) {
    return {
      whatsapp: { status: "skipped", motivo: "falha já notificada (marco)" },
      email: { status: "skipped", motivo: "falha já notificada (marco)" },
    };
  }

  const resultado: FalhaPagamentoResultado = {
    whatsapp: { status: "skipped" },
    email: { status: "skipped" },
  };

  // Canal WhatsApp (ação imediata). Sem gateway injetado nem Cloud API
  // configurada, pula o canal (e-mail segue).
  const destinatario = normalizarWhatsapp(dados.whatsapp);
  if (destinatario && (deps.whatsapp || whatsappConfigurado())) {
    const padrao = await criarTemplateRepo().obterVariaveis(
      "assinatura_pagamento_falhou",
    );
    const res = await enviarTemplate(
      {
        destinatario,
        template: "assinatura_pagamento_falhou",
        variaveis: ordenarVariaveis("assinatura_pagamento_falhou", {
          ...padrao,
          nome_cliente: dados.clienteNome,
          link: dados.linkAtualizacao,
        }),
      },
      { gateway: deps.whatsapp, agora: deps.agora },
    );
    resultado.whatsapp = { status: res.status, messageId: res.messageId };
  } else if (!destinatario) {
    console.log(
      `[falha-pagamento] whatsapp_skipped: cliente ${dados.clienteNome} sem WhatsApp válido.`,
    );
    resultado.whatsapp = { status: "skipped", motivo: "cliente sem WhatsApp válido" };
  }

  // Canal e-mail.
  if (dados.email) {
    const html = await renderizarEmailFalhaPagamento({
      clienteNome: dados.clienteNome,
      planoNome: dados.planoNome,
      linkAtualizacao: dados.linkAtualizacao,
    });
    const emailService = deps.email ?? criarEmailService();
    const res = await emailService.enviar({
      para: dados.email,
      assunto: "Falha no pagamento da sua assinatura — DBG Elétrica e Pintura",
      html,
    });
    resultado.email = { status: "sent", emailId: res?.id };
  } else {
    console.log(
      `[falha-pagamento] email_skipped: cliente ${dados.clienteNome} sem e-mail.`,
    );
    resultado.email = { status: "skipped", motivo: "cliente sem e-mail" };
  }

  return resultado;
}

/** Loader interno: cliente + plano pela preapproval, link MP de gestão. */
async function carregarDados(preapprovalIdMp: string) {
  const [row] = await db
    .select({
      assinaturaId: assinatura.id,
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
    ...row,
    linkAtualizacao: `${baseMp}/${preapprovalIdMp}`,
  };
}
