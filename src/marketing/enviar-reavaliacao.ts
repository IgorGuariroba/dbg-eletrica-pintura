import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { ordemServico, solicitacao, cliente } from "@/db/schema";
import { enviarTemplate } from "@/notificacao/enviar-template";
import { criarTemplateRepo, normalizarWhatsapp, ordenarVariaveis } from "@/notificacao/templates";
import { criarEmailService, renderizarEmailReavaliacao } from "@/notificacao/email-service";
import { whatsappConfigurado } from "@/notificacao/whatsapp-gateway";

/**
 * Envia o convite de reavaliação ao cliente via WhatsApp + e-mail.
 * Usado pelo resolverTratativa após marcar o alerta como RESOLVIDO.
 * O link aponta especificamente para /s/{token}/reavaliar (não /avaliar).
 */
export async function enviarReavaliacaoPorOsId(osId: string): Promise<void> {
  // 1. Carregar OS + solicitação + cliente
  const [os] = await db
    .select({ solicitacaoId: ordemServico.solicitacaoId })
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);

  if (!os) {
    console.log(`[reavaliacao] OS ${osId} não encontrada — skip`);
    return;
  }

  const [sol] = await db
    .select({ token: solicitacao.token, clienteId: solicitacao.clienteId })
    .from(solicitacao)
    .where(eq(solicitacao.id, os.solicitacaoId))
    .limit(1);

  if (!sol) {
    console.log(`[reavaliacao] solicitação para OS ${osId} não encontrada — skip`);
    return;
  }

  const [cli] = await db
    .select({ nome: cliente.nome, whatsapp: cliente.whatsapp, email: cliente.email })
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);

  if (!cli) {
    console.log(`[reavaliacao] cliente para OS ${osId} não encontrado — skip`);
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // Link de reavaliação: /reavaliar (não /avaliar)
  const linkReavaliacao = `${siteUrl}/s/${sol.token}/reavaliar`;

  // 2. WhatsApp (se configurado) — template reavaliacao_pedido
  const destinatario = normalizarWhatsapp(cli.whatsapp);
  if (destinatario && whatsappConfigurado()) {
    const repo = criarTemplateRepo();
    const padrao = await repo.obterVariaveis("reavaliacao_pedido");
    const dinamicas = { nome_cliente: cli.nome, link: linkReavaliacao };
    const variaveis = ordenarVariaveis("reavaliacao_pedido", { ...padrao, ...dinamicas });

    await enviarTemplate({ destinatario, template: "reavaliacao_pedido", variaveis });
  }

  // 3. E-mail — usa template dedicado PedidoReavaliacaoEmail com urlReavaliacao
  //    apontando diretamente para /reavaliar (não /avaliar)
  if (cli.email) {
    const html = await renderizarEmailReavaliacao({
      clienteNome: cli.nome,
      urlReavaliacao: linkReavaliacao,
    });

    const emailService = criarEmailService();
    await emailService.enviar({
      para: cli.email,
      assunto: "Sua opinião importa — como foi após nossa tratativa?",
      html,
    });
  } else {
    console.log(`[reavaliacao] cliente ${cli.nome} sem e-mail — skip e-mail`);
  }
}
