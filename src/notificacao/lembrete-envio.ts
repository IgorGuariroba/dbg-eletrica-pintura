import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cliente, orcamento, ordemServico, solicitacao } from "@/db/schema";
import type { DespachoWhatsapp } from "./dispatcher";
import {
  criarEmailService,
  renderizarEmailLembretePagamento,
  type EmailService,
} from "./email-service";
import { enviarTemplate } from "./enviar-template";
import { claimMarco } from "./marco";
import { notificarMudancaEstadoOs, type NotificacaoResultado } from "./notificador";
import { criarTemplateRepo, normalizarWhatsapp, ordenarVariaveis } from "./templates";
import { whatsappConfigurado, type GatewayWhatsApp } from "./whatsapp-gateway";

export interface LembreteResultado {
  whatsapp: DespachoWhatsapp;
  email: NotificacaoResultado;
}

interface LembreteDeps {
  whatsapp?: GatewayWhatsApp;
  email?: EmailService;
  agora?: Date;
}

const skip = (motivo: string): LembreteResultado => ({
  whatsapp: { status: "skipped", motivo },
  email: { status: "skipped", motivo },
});

/**
 * Envio do Lembrete de Pagamento (evento `os.lembrete_pagamento`): a banda
 * (dia1/dia3) vem do job (elegibilidade é da varredura); o Marco de
 * Notificação (osId, `lembrete_pagamento:{banda}`) garante envio único por
 * banda — mesmas chaves de marco de antes do refactor, dedup preservado.
 */
export async function enviarLembretePagamento(
  evento: { osId: string; banda: "dia1" | "dia3" },
  deps: LembreteDeps = {},
): Promise<LembreteResultado> {
  if (!(await claimMarco(evento.osId, `lembrete_pagamento:${evento.banda}`))) {
    return skip("lembrete já enviado (marco)");
  }

  const ctx = await carregarContexto(evento.osId);
  if (!ctx) return skip("contexto da OS não encontrado");

  const resultado = skip("");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const link = `${siteUrl}/s/${ctx.token}`;
  const numeroOS = evento.osId.slice(0, 8).toUpperCase();
  const valor = Number(ctx.total).toFixed(2);

  // WhatsApp (ação imediata). Sem gateway injetado nem Cloud API configurada,
  // pula o canal (e-mail segue).
  const destinatario = normalizarWhatsapp(ctx.cli.whatsapp);
  if (destinatario && (deps.whatsapp || whatsappConfigurado())) {
    const padrao = await criarTemplateRepo().obterVariaveis("lembrete_pagamento");
    const res = await enviarTemplate(
      {
        destinatario,
        template: "lembrete_pagamento",
        // Ordem posicional fixada no catálogo — deve casar com o template Meta.
        variaveis: ordenarVariaveis("lembrete_pagamento", {
          ...padrao,
          nome_cliente: ctx.cli.nome,
          valor,
          link,
        }),
      },
      { gateway: deps.whatsapp, agora: deps.agora },
    );
    resultado.whatsapp = { status: res.status, messageId: res.messageId };
  } else if (!destinatario) {
    console.log(
      `[lembrete] whatsapp_skipped: cliente ${ctx.cli.nome} sem WhatsApp válido (${ctx.cli.whatsapp}).`,
    );
    resultado.whatsapp = { status: "skipped", motivo: "cliente sem WhatsApp válido" };
  }

  // E-mail (documento/cobrança).
  if (ctx.cli.email) {
    const html = await renderizarEmailLembretePagamento({
      clienteNome: ctx.cli.nome,
      numeroOS,
      valor,
      urlPortal: link,
    });
    const emailService = deps.email ?? criarEmailService();
    const res = await emailService.enviar({
      para: ctx.cli.email,
      assunto: `Pagamento pendente - OS ${numeroOS}`,
      html,
    });
    resultado.email = { status: "sent", emailId: res?.id };
  } else {
    console.log(`[lembrete] email_skipped: cliente ${ctx.cli.nome} sem e-mail.`);
    resultado.email = { status: "skipped", motivo: "cliente sem e-mail" };
  }

  return resultado;
}

/**
 * Envio do Lembrete de Avaliação (evento `os.lembrete_avaliacao`): a OS do
 * evento é a âncora da Solicitação elegível. O Marco de Notificação usa a
 * SOLICITAÇÃO como referência (`(solicitacaoId, lembrete_avaliacao)`) — a
 * âncora pode variar entre execuções do job e o lembrete é 1 por Solicitação
 * (substitui a flag `lembrete_avaliacao_enviado` com a mesma semântica).
 */
export async function enviarLembreteAvaliacao(
  evento: { osId: string },
  deps: LembreteDeps = {},
): Promise<LembreteResultado> {
  const [os] = await db
    .select({ solicitacaoId: ordemServico.solicitacaoId })
    .from(ordemServico)
    .where(eq(ordemServico.id, evento.osId))
    .limit(1);
  if (!os) return skip("OS não encontrada");

  const [sol] = await db
    .select({
      id: solicitacao.id,
      token: solicitacao.token,
      clienteId: solicitacao.clienteId,
    })
    .from(solicitacao)
    .where(eq(solicitacao.id, os.solicitacaoId))
    .limit(1);
  if (!sol) return skip("solicitação não encontrada");

  if (!(await claimMarco(sol.id, "lembrete_avaliacao"))) {
    return skip("lembrete já enviado (marco)");
  }

  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);
  if (!cli) return skip("cliente não encontrado");

  const resultado = skip("");

  // WhatsApp (ação imediata).
  const destinatario = normalizarWhatsapp(cli.whatsapp);
  if (destinatario && (deps.whatsapp || whatsappConfigurado())) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const padrao = await criarTemplateRepo().obterVariaveis("pedido_avaliacao");
    const res = await enviarTemplate(
      {
        destinatario,
        template: "pedido_avaliacao",
        variaveis: ordenarVariaveis("pedido_avaliacao", {
          ...padrao,
          nome_cliente: cli.nome,
          link: `${siteUrl}/s/${sol.token}/avaliar`,
        }),
      },
      { gateway: deps.whatsapp, agora: deps.agora },
    );
    resultado.whatsapp = { status: res.status, messageId: res.messageId };
  } else if (!destinatario) {
    resultado.whatsapp = { status: "skipped", motivo: "cliente sem WhatsApp válido" };
  }

  // E-mail (delegado ao notificador, que trata skip sem e-mail).
  resultado.email = await notificarMudancaEstadoOs(evento.osId, "PEDIDO_AVALIACAO", {
    emailService: deps.email,
  });

  return resultado;
}

/** Contexto do lembrete de pagamento: token da Solicitação, cliente e total. */
async function carregarContexto(osId: string) {
  const [os] = await db
    .select({ solicitacaoId: ordemServico.solicitacaoId })
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);
  if (!os) return null;

  const [sol] = await db
    .select({ token: solicitacao.token, clienteId: solicitacao.clienteId })
    .from(solicitacao)
    .where(eq(solicitacao.id, os.solicitacaoId))
    .limit(1);
  if (!sol) return null;

  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);
  if (!cli) return null;

  const [orc] = await db
    .select({ total: orcamento.total })
    .from(orcamento)
    .where(eq(orcamento.osId, osId))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);

  return { cli, token: sol.token, total: orc?.total ?? "0" };
}
