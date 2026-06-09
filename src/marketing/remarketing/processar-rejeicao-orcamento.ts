import { and, eq, isNotNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import { orcamento, ordemServico, solicitacao, cliente } from "@/db/schema";
import { normalizarWhatsapp, ordenarVariaveis } from "@/notificacao/templates";
import { enviarTemplate } from "@/notificacao/enviar-template";
import { whatsappConfigurado } from "@/notificacao/whatsapp-gateway";
import { renderizarEmailRemarketing } from "@/notificacao/email-service";
import type { ConfigRemarketing } from "./config-repo";
import type { RemarketingEnviadoRepo } from "./enviado-repo";
import type { ProcessarRemarketingDeps } from "./processar-remarketing";

export async function processarRejeicaoOrcamento(
  db: DB,
  config: ConfigRemarketing,
  enviadoRepo: RemarketingEnviadoRepo,
  deps: ProcessarRemarketingDeps,
): Promise<number> {
  const agora = deps.agora ?? new Date();
  const templateRepo = deps.templateRepo ?? (await import("@/notificacao/templates")).criarTemplateRepo(db);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Orçamentos rejeitados (OS REJEITADA e rejeitadoEm preenchido)
  const candidatas = await db
    .select({
      orc: orcamento,
      os: ordemServico,
      sol: solicitacao,
      cli: cliente,
    })
    .from(orcamento)
    .innerJoin(ordemServico, eq(orcamento.osId, ordemServico.id))
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(and(eq(ordemServico.estado, "REJEITADA"), isNotNull(orcamento.rejeitadoEm)));

  let enviados = 0;
  const offsets = [...config.prazosDias].sort((a, b) => b - a);

  for (const cand of candidatas) {
    if (!cand.orc.rejeitadoEm) continue;

    const diffHoras = (agora.getTime() - cand.orc.rejeitadoEm.getTime()) / 3_600_000;
    if (diffHoras < 0) continue;

    const n = offsets.find((offset) => diffHoras >= offset * 24);
    if (n === undefined) continue;

    const contexto = cand.orc.id; // contexto simples por orçamento
    const claimed = await enviadoRepo.claim(config.gatilho, cand.cli.id, contexto);
    if (!claimed) continue;

    const tplId = config.templateId ?? "orcamento_rejeitado";
    const padrao = await templateRepo.obterVariaveis(tplId);
    const link = `${siteUrl}/s/${cand.sol.token}`;

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
      const corpo = `Gostaríamos de conversar sobre o orçamento rejeitado para o seu serviço de ${cand.os.categoria.toLowerCase()}. Caso queira reavaliar ou fazer uma nova proposta, acesse o link abaixo.`;
      const html = await renderizarEmailRemarketing({
        clienteNome: cand.cli.nome,
        titulo: "Que tal reavaliar sua solicitação?",
        corpo,
        ctaText: "Acessar Portal",
        ctaUrl: link,
      });
      await deps.enviarEmail({
        para: cand.cli.email,
        clienteNome: cand.cli.nome,
        assunto: `Reavaliação de orçamento`,
        html,
      });
      algumCanal = true;
    }

    if (algumCanal) enviados++;
  }

  return enviados;
}
