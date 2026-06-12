import type { EstadoOs } from "@/operacao/orcamento-repo";
import {
  gerarDocumentosOs,
  type GerarDocumentosResultado,
} from "@/documentos/gerar-documentos-os";
import { despacharEventoOs, type DespachoResultado } from "./dispatcher";
import { notificarMudancaEstadoOs } from "./notificador";
import {
  notificarBoasVindasAssinatura,
  type ConsultaAssinaturaMp,
} from "./boas-vindas-assinatura";
import { notificarFalhaPagamentoAssinatura } from "./falha-pagamento-assinatura";
import type { EmailService } from "./email-service";
import type { GatewayWhatsApp } from "./whatsapp-gateway";

/**
 * Evento de Notificação: união discriminada consumida pela interface única do
 * contexto. O emissor entrega só identificadores; Notificação carrega os dados
 * do render por conta própria (loaders Drizzle internos, não injetáveis).
 * Demais membros (os.lembrete_*, assinatura.pagamento_falhou) entram em
 * fatias futuras.
 */
export type EventoNotificacao =
  | { tipo: "os.transicao"; osId: string; estadoNovo: EstadoOs }
  | { tipo: "assinatura.criada"; preapprovalIdMp: string }
  // Combo "pagar tudo junto + assinar" (#65): sem pre-approval no MP, lookup
  // pelo id local e próxima cobrança "a confirmar".
  | { tipo: "assinatura.criada_combo"; assinaturaId: string }
  // `eventId` = notificação do webhook MP: o marco é por falha (reexecução do
  // mesmo webhook não reenvia; falha de ciclo futuro notifica de novo).
  | {
      tipo: "assinatura.pagamento_falhou";
      preapprovalIdMp: string;
      eventId: string;
    };

/** Adapter de saída de documentos (fatura/certificado/relatório + e-mail). */
export type GeradorDocumentos = (
  osId: string,
  estadoNovo: string,
) => Promise<GerarDocumentosResultado>;

/**
 * Dependências de `notificar`: apenas adapters de saída + relógio. Defaults de
 * produção: Cloud API (por env), Resend e gerador de documentos reais.
 */
export interface NotificarDeps {
  /** Adapter de saída da Cloud API (default: real/mock por env). */
  whatsapp?: GatewayWhatsApp;
  /** Adapter de saída de e-mail (default: Resend/mock por env). */
  email?: EmailService;
  /** Adapter de saída de documentos (default: gerarDocumentosOs → R2+Resend). */
  documentos?: GeradorDocumentos;
  /**
   * Consulta de assinatura no MP (próxima cobrança das boas-vindas; default:
   * adapter real). Emissor que já tem o recurso em mãos injeta para evitar
   * segunda chamada ao MP.
   */
  mpAssinatura?: ConsultaAssinaturaMp;
  /** Relógio injetável (default: agora). Repassado ao Horário Restrito. */
  agora?: Date;
}

export type NotificarResultado = DespachoResultado;

/**
 * Interface única do contexto Notificação: consome um Evento de Notificação e
 * decide internamente canal (Prioridade de Canal), template, variáveis,
 * Horário Restrito/fila, e-mail+PDF e idempotência via Marco de Notificação.
 * Cliente sem WhatsApp/e-mail válido → pula o canal e loga, sem lançar.
 */
export async function notificar(
  evento: EventoNotificacao,
  deps: NotificarDeps = {},
): Promise<NotificarResultado> {
  switch (evento.tipo) {
    case "os.transicao":
      return despacharEventoOs(evento.osId, evento.estadoNovo, {
        gateway: deps.whatsapp,
        agora: deps.agora,
        enviarEmail: deps.email
          ? (osId, estado) =>
              notificarMudancaEstadoOs(osId, estado, {
                emailService: deps.email,
              })
          : undefined,
        // Sem deps.email, gerarDocumentosOs usa o serviço default (Resend/mock
        // por env) — mesmo comportamento do default interno do dispatcher.
        gerarDocumentos:
          deps.documentos ??
          ((osId, estado) =>
            gerarDocumentosOs(osId, estado as EstadoOs, { email: deps.email })),
      });

    case "assinatura.criada":
    case "assinatura.criada_combo":
      return {
        email: await notificarBoasVindasAssinatura(evento, {
          email: deps.email,
          mpAssinatura: deps.mpAssinatura,
        }),
      };

    case "assinatura.pagamento_falhou":
      return notificarFalhaPagamentoAssinatura(evento, {
        whatsapp: deps.whatsapp,
        email: deps.email,
        agora: deps.agora,
      });
  }
}
