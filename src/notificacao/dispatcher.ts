import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cliente, membro, ordemServico, solicitacao } from "@/db/schema";
import { TIPOS_PAGAVEIS } from "./lembrete-pagamento";
import { claimMarco } from "./marco";
import { enviarTemplate } from "./enviar-template";
import { notificarMudancaEstadoOs, type NotificacaoResultado } from "./notificador";
import {
  gerarDocumentosOs,
  type GerarDocumentosResultado,
} from "@/documentos/gerar-documentos-os";
import type { EstadoOs } from "@/operacao/orcamento-repo";
import {
  criarTemplateRepo,
  normalizarWhatsapp,
  ordenarVariaveis,
  type TemplateRepo,
} from "./templates";
import { whatsappConfigurado, type GatewayWhatsApp } from "./whatsapp-gateway";

/**
 * Mapa de Evento de Notificação: cada transição de estado da OS define qual
 * template WhatsApp dispara (ação imediata), se sai e-mail de conclusão e se
 * gera documentos (fatura/certificado). Ver Prioridade de Canal em CONTEXT.md.
 *
 * - ORCADA: orçamento pronto por WhatsApp + e-mail com PDF.
 * - A_CAMINHO: técnico a caminho por WhatsApp (sem e-mail).
 * - CONCLUIDA: e-mail de conclusão + documentos (certificado de regarantia
 *   para OS GARANTIA; demais tipos só geram documentos no PAGA).
 * - PAGA: documentos (fatura + certificado), sem WhatsApp/e-mail próprios.
 */
const MAPA_EVENTOS: Record<
  string,
  { template?: string; email?: boolean; documentos?: boolean }
> = {
  ORCADA: { template: "orcamento_pronto", email: true },
  A_CAMINHO: { template: "tecnico_a_caminho" },
  CONCLUIDA: { email: true, documentos: true },
  PAGA: { documentos: true },
};

export interface DespachoWhatsapp {
  status: "enviado" | "enfileirado" | "skipped";
  motivo?: string;
  messageId?: string;
}

export interface DespachoResultado {
  whatsapp?: DespachoWhatsapp;
  email?: NotificacaoResultado;
  documentos?: GerarDocumentosResultado;
  /**
   * Convite à avaliação (Issue #51). Canal próprio: num CONCLUIDA de OS
   * não-pagável saem DOIS e-mails distintos — o de conclusão (`email`) e o
   * convite à avaliação (`avaliacao.email`) —, por isso resultados separados.
   */
  avaliacao?: { whatsapp?: DespachoWhatsapp; email?: NotificacaoResultado };
}

export interface DespacharDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
  /** Relógio injetável (default: agora). Repassado ao Horário Restrito. */
  agora?: Date;
  /** Repo de variáveis padrão dos templates (default: Drizzle). */
  templateRepo?: TemplateRepo;
  /** Envio de e-mail por transição (default: notificarMudancaEstadoOs). */
  enviarEmail?: (osId: string, estado: string) => Promise<NotificacaoResultado>;
  /** Geração de documentos por transição (default: gerarDocumentosOs). */
  gerarDocumentos?: (
    osId: string,
    estado: string,
  ) => Promise<GerarDocumentosResultado>;
  /** Força mock no envio de e-mail default (PDF/Resend). */
  forceMock?: boolean;
  /** Obtém o tipo da OS por ID (default: query Drizzle). */
  obterOs?: (
    osId: string,
  ) => Promise<Pick<typeof ordemServico.$inferSelect, "tipo"> | undefined>;
  /**
   * Reivindica o marco de convite à avaliação (idempotência). Default:
   * `claimMarco` genérico do contexto (Marco de Notificação). Injetável para
   * isolar testes do banco.
   */
  claimAvaliacao?: (osId: string) => Promise<boolean>;
}

/**
 * Dispatcher de notificações: mapeia uma transição de estado da OS para os
 * canais aplicáveis e dispara cada um conforme a Prioridade de Canal. WhatsApp
 * passa por `enviarTemplate` (horário restrito + fila); e-mail é delegado ao
 * notificador (PDF + Resend). Cliente sem número/e-mail válido → pula o canal e
 * loga, sem lançar erro.
 *
 * Seam INTERNO do contexto Notificação (#159): emissores usam a interface
 * única `notificar(evento)` de `./notificar` — não importar daqui fora do
 * contexto/testes.
 */
export async function despacharEventoOs(
  osId: string,
  estadoNovo: string,
  deps: DespacharDeps = {},
): Promise<DespachoResultado> {
  const resultado: DespachoResultado = {};

  // Convite à avaliação (Issue #51): só no estado terminal do cliente — PAGA
  // para tipos pagáveis, CONCLUIDA para os demais (Preventiva/Garantia, sem
  // cobrança). Demais transições nunca avaliam, então só aqui vale carregar o
  // tipo da OS — fora desses estados não há query extra.
  if (estadoNovo === "PAGA" || estadoNovo === "CONCLUIDA") {
    const obterOs = deps.obterOs ?? (async (id) => {
      const [row] = await db
        .select({ tipo: ordemServico.tipo })
        .from(ordemServico)
        .where(eq(ordemServico.id, id))
        .limit(1);
      return row;
    });

    // OS pode ter sumido entre a transição e o despacho — sem ela, nada a
    // avaliar (o MAPA_EVENTOS adiante trata a ausência por conta própria).
    const os = await obterOs(osId);
    if (os) {
      const pagavel = (TIPOS_PAGAVEIS as readonly string[]).includes(os.tipo);
      const deveAvaliar = pagavel ? estadoNovo === "PAGA" : estadoNovo === "CONCLUIDA";

      if (deveAvaliar) {
        // Reivindica o marco ANTES de enviar: reexecução da transição não reenvia.
        const claimAvaliacao =
          deps.claimAvaliacao ??
          ((id: string) => claimMarco(id, "pedido_avaliacao:disparo"));

        if (await claimAvaliacao(osId)) {
          const avaliacao: { whatsapp?: DespachoWhatsapp; email?: NotificacaoResultado } = {};
          if (deps.gateway || whatsappConfigurado()) {
            avaliacao.whatsapp = await despacharWhatsapp(osId, "pedido_avaliacao", deps);
          }
          const enviarEmail =
            deps.enviarEmail ??
            ((id, est) =>
              notificarMudancaEstadoOs(id, est, { forceMock: deps.forceMock }));
          avaliacao.email = await enviarEmail(osId, "PEDIDO_AVALIACAO");
          resultado.avaliacao = avaliacao;
        }
      }
    }
  }

  const evento = MAPA_EVENTOS[estadoNovo];
  if (!evento) return resultado;

  // Canal WhatsApp (ação imediata). Sem gateway injetado e sem Cloud API
  // configurada, pula o canal — não há como enviar/enfileirar (e-mail segue).
  if (evento.template && (deps.gateway || whatsappConfigurado())) {
    resultado.whatsapp = await despacharWhatsapp(osId, evento.template, deps);
  }

  // Canal e-mail (documento). Delega ao notificador, que trata skip sem e-mail.
  if (evento.email) {
    const enviarEmail =
      deps.enviarEmail ??
      ((id, estado) =>
        notificarMudancaEstadoOs(id, estado, { forceMock: deps.forceMock }));
    resultado.email = await enviarEmail(osId, estadoNovo);
  }

  // Documentos (fatura/certificado). gerarDocumentosOs auto-filtra por
  // tipo/estado (planejarDocumentos) — retorna skip quando não aplicável.
  if (evento.documentos) {
    const gerar =
      deps.gerarDocumentos ??
      ((id, estado) =>
        gerarDocumentosOs(id, estado as EstadoOs, { forceMock: deps.forceMock }));
    resultado.documentos = await gerar(osId, estadoNovo);
  }

  return resultado;
}

/** Carrega o contexto da OS, monta as variáveis e dispara o template. */
async function despacharWhatsapp(
  osId: string,
  template: string,
  deps: DespacharDeps,
): Promise<DespachoWhatsapp> {
  const [os] = await db
    .select()
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);
  if (!os) return { status: "skipped", motivo: "OS não encontrada" };

  const [sol] = await db
    .select()
    .from(solicitacao)
    .where(eq(solicitacao.id, os.solicitacaoId))
    .limit(1);
  if (!sol) return { status: "skipped", motivo: "solicitação não encontrada" };

  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);
  if (!cli) return { status: "skipped", motivo: "cliente não encontrado" };

  const destinatario = normalizarWhatsapp(cli.whatsapp);
  if (!destinatario) {
    console.log(
      `[dispatcher] whatsapp_skipped: cliente ${cli.nome} sem WhatsApp válido (${cli.whatsapp}).`,
    );
    return { status: "skipped", motivo: "cliente sem WhatsApp válido" };
  }

  let tecnicoNome = "Não atribuído";
  if (os.tecnicoId) {
    const [tec] = await db
      .select({ nome: membro.nome })
      .from(membro)
      .where(eq(membro.id, os.tecnicoId))
      .limit(1);
    if (tec) tecnicoNome = tec.nome;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const urlPortal = `${siteUrl}/s/${sol.token}`;

  const dinamicas = montarVariaveis(template, {
    clienteNome: cli.nome,
    tecnicoNome,
    urlPortal,
  });

  const repo = deps.templateRepo ?? criarTemplateRepo();
  const padrao = await repo.obterVariaveis(template);
  // Ordem posicional fixada no catálogo — deve casar com o template Meta.
  const variaveis = ordenarVariaveis(template, { ...padrao, ...dinamicas });

  const res = await enviarTemplate(
    { destinatario, template, variaveis },
    { gateway: deps.gateway, agora: deps.agora },
  );
  return { status: res.status, messageId: res.messageId };
}

/** Variáveis dinâmicas (do evento) por template. */
function montarVariaveis(
  template: string,
  ctx: { clienteNome: string; tecnicoNome: string; urlPortal: string },
): Record<string, string> {
  switch (template) {
    case "orcamento_pronto":
      return { nome_cliente: ctx.clienteNome, link: ctx.urlPortal };
    case "pedido_avaliacao":
      return { nome_cliente: ctx.clienteNome, link: ctx.urlPortal + "/avaliar" };
    case "tecnico_a_caminho":
      return { nome_cliente: ctx.clienteNome, nome_tecnico: ctx.tecnicoNome };
    default:
      return { nome_cliente: ctx.clienteNome };
  }
}
