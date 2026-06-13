import { db as dbPadrao } from "@/db/client";
import { criarConfigRemarketingRepoDrizzle } from "./config-repo";
import { criarRemarketingEnviadoRepoDrizzle } from "./enviado-repo";
import { processarLembreteOrcamento } from "./processar-lembrete-orcamento";
import { processarRejeicaoOrcamento } from "./processar-rejeicao-orcamento";
import { processarReativacaoInativos } from "./processar-reativacao-inativos";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";
import type { TemplateRepo } from "@/notificacao/templates";

export interface ProcessarRemarketingDeps {
  gateway?: GatewayWhatsApp;
  agora?: Date;
  templateRepo?: TemplateRepo;
  enviarEmail?: (input: { para: string; clienteNome: string; assunto: string; html: string }) => Promise<{ id: string } | null>;
  forceMock?: boolean;
}

export async function processarRemarketing(
  deps: ProcessarRemarketingDeps = {},
): Promise<Record<string, number>> {
  const db = dbPadrao;
  const configRepo = criarConfigRemarketingRepoDrizzle(db);
  const enviadoRepo = criarRemarketingEnviadoRepoDrizzle(db);

  const configs = await configRepo.listar();
  const resultado: Record<string, number> = {
    lembrete_orcamento: 0,
    rejeicao_orcamento: 0,
    reativacao_inativos: 0,
  };

  for (const cfg of configs) {
    if (!cfg.ativo) continue;

    if (cfg.gatilho === "lembrete_orcamento") {
      resultado.lembrete_orcamento = await processarLembreteOrcamento(db, cfg, enviadoRepo, deps);
    } else if (cfg.gatilho === "rejeicao_orcamento") {
      resultado.rejeicao_orcamento = await processarRejeicaoOrcamento(db, cfg, enviadoRepo, deps);
    } else if (cfg.gatilho === "reativacao_inativos") {
      resultado.reativacao_inativos = await processarReativacaoInativos(db, cfg, enviadoRepo, deps);
    }
  }

  return resultado;
}
