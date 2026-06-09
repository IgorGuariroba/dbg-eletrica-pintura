import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { solicitacao, cliente } from "@/db/schema";
import { normalizarWhatsapp, ordenarVariaveis } from "@/notificacao/templates";
import { enviarTemplate } from "@/notificacao/enviar-template";
import { whatsappConfigurado } from "@/notificacao/whatsapp-gateway";
import { renderizarEmailRemarketing } from "@/notificacao/email-service";
import type { ConfigRemarketing } from "./config-repo";
import type { RemarketingEnviadoRepo } from "./enviado-repo";
import type { ProcessarRemarketingDeps } from "./processar-remarketing";

export async function processarReativacaoInativos(
  db: DB,
  config: ConfigRemarketing,
  enviadoRepo: RemarketingEnviadoRepo,
  deps: ProcessarRemarketingDeps,
): Promise<number> {
  const agora = deps.agora ?? new Date();
  const templateRepo = deps.templateRepo ?? (await import("@/notificacao/templates")).criarTemplateRepo(db);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Subquery para obter o max(criadoEm) de solicitações por cliente
  const sub = db
    .select({
      clienteId: solicitacao.clienteId,
      ultimaSolicitacao: sql<Date>`max(${solicitacao.criadoEm})`.as("ultima_solicitacao"),
    })
    .from(solicitacao)
    .groupBy(solicitacao.clienteId)
    .as("sub");

  // Clientes e a data da última solicitação
  const candidatas = await db
    .select({
      cli: cliente,
      ultimaSolicitacao: sub.ultimaSolicitacao,
    })
    .from(cliente)
    .innerJoin(sub, eq(cliente.id, sub.clienteId));

  let enviados = 0;
  const offsets = [...config.prazosDias].sort((a, b) => b - a);

  for (const cand of candidatas) {
    if (!cand.ultimaSolicitacao) continue;

    const diffHoras = (agora.getTime() - new Date(cand.ultimaSolicitacao).getTime()) / 3_600_000;
    if (diffHoras < 0) continue;

    const n = offsets.find((offset) => diffHoras >= offset * 24);
    if (n === undefined) continue;

    // Balde mensal: YYYY-MM
    const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const claimed = await enviadoRepo.claim(config.gatilho, cand.cli.id, anoMes);
    if (!claimed) continue;

    const tplId = config.templateId ?? "cliente_inativo";
    const padrao = await templateRepo.obterVariaveis(tplId);
    const link = `${siteUrl}/solicitar`;

    let algumCanal = false;

    // WhatsApp
    const destinatario = normalizarWhatsapp(cand.cli.whatsapp);
    if (destinatario && (deps.gateway || whatsappConfigurado())) {
      await enviarTemplate(
        {
          destinatario,
          template: tplId,
          variaveis: ordenarVariaveis(tplId, {
            ...padrao,
            nome_cliente: cand.cli.nome,
            link,
          }),
        },
        { gateway: deps.gateway, agora },
      );
      algumCanal = true;
    }

    // E-mail
    if (cand.cli.email && deps.enviarEmail) {
      const corpo = `Faz algum tempo que não recebemos solicitações suas. Se precisar de novos serviços de elétrica ou pintura, fale conosco pelo link abaixo.`;
      const html = await renderizarEmailRemarketing({
        clienteNome: cand.cli.nome,
        titulo: "Sentimos sua falta!",
        corpo,
        ctaText: "Solicitar Novo Serviço",
        ctaUrl: link,
      });
      await deps.enviarEmail({
        para: cand.cli.email,
        clienteNome: cand.cli.nome,
        assunto: `Olá! Sentimos sua falta`,
        html,
      });
      algumCanal = true;
    }

    if (algumCanal) enviados++;
  }

  return enviados;
}
