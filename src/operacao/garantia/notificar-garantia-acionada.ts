import { db } from "@/db/client";
import { ordemServico, solicitacao, cliente } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizarWhatsapp, criarTemplateRepo, ordenarVariaveis } from "@/notificacao/templates";
import { enviarTemplate } from "@/notificacao/enviar-template";
import { criarEmailService, renderizarEmailGarantiaAcionada } from "@/notificacao/email-service";

export async function notificarGarantiaAcionada(
  osGarantiaId: string,
  deps: {
    dbClient?: typeof db;
    forceMock?: boolean;
    agora?: Date;
  } = {},
): Promise<void> {
  const dbClient = deps.dbClient ?? db;

  try {
    // 1. Carrega OS Garantia
    const [os] = await dbClient
      .select()
      .from(ordemServico)
      .where(eq(ordemServico.id, osGarantiaId))
      .limit(1);
    if (!os) {
      console.warn(`[notificarGarantiaAcionada] OS ${osGarantiaId} não encontrada.`);
      return;
    }

    // 2. Carrega Solicitação
    const [sol] = await dbClient
      .select()
      .from(solicitacao)
      .where(eq(solicitacao.id, os.solicitacaoId))
      .limit(1);
    if (!sol) {
      console.warn(`[notificarGarantiaAcionada] Solicitação ${os.solicitacaoId} não encontrada.`);
      return;
    }

    // 3. Carrega Cliente
    const [cli] = await dbClient
      .select()
      .from(cliente)
      .where(eq(cliente.id, sol.clienteId))
      .limit(1);
    if (!cli) {
      console.warn(`[notificarGarantiaAcionada] Cliente ${sol.clienteId} não encontrado.`);
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const urlPortal = `${siteUrl}/s/${sol.token}`;
    const numeroOS = os.id.slice(0, 8).toUpperCase();

    // 4. Envia WhatsApp se tiver número válido
    const destinatarioWa = normalizarWhatsapp(cli.whatsapp);
    if (destinatarioWa) {
      try {
        const template = "garantia_acionada";
        const repo = criarTemplateRepo(dbClient as any);
        const padrao = await repo.obterVariaveis(template);
        const dinamicas = { nome_cliente: cli.nome, link: urlPortal };
        const variaveis = ordenarVariaveis(template, { ...padrao, ...dinamicas });

        await enviarTemplate(
          { destinatario: destinatarioWa, template, variaveis },
          { agora: deps.agora },
        );
        console.log(`[notificarGarantiaAcionada] WhatsApp enviado/enfileirado para ${cli.nome}.`);
      } catch (err: any) {
        console.error(`[notificarGarantiaAcionada] Falha ao enviar WhatsApp: ${err?.message}`);
      }
    } else {
      console.log(`[notificarGarantiaAcionada] Cliente ${cli.nome} sem WhatsApp válido.`);
    }

    // 5. Envia E-mail se tiver e-mail válido
    if (cli.email && cli.email.includes("@")) {
      try {
        const emailService = criarEmailService({ forceMock: deps.forceMock });
        const html = await renderizarEmailGarantiaAcionada({
          clienteNome: cli.nome,
          numeroOS,
          urlPortal,
        });

        await emailService.enviar({
          para: cli.email,
          assunto: `Sua garantia foi acionada - OS #${numeroOS}`,
          html,
        });
        console.log(`[notificarGarantiaAcionada] E-mail enviado para ${cli.email}.`);
      } catch (err: any) {
        console.error(`[notificarGarantiaAcionada] Falha ao enviar e-mail: ${err?.message}`);
      }
    } else {
      console.log(`[notificarGarantiaAcionada] Cliente ${cli.nome} sem e-mail cadastrado.`);
    }
  } catch (err: any) {
    console.error(`[notificarGarantiaAcionada] Erro inesperado ao processar notificações: ${err?.message}`);
  }
}
