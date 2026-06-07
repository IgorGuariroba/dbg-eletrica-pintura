import type {
  AssinaturaRepo,
  PatchAssinatura,
  StatusAssinatura,
} from "./assinatura-repo";

/** Tipos de evento de assinatura que o sistema reconhece. */
export type TipoEventoAssinatura =
  | "created"
  | "authorized"
  | "paused"
  | "cancelled"
  | "payment_failed"
  | "payment_recovered";

export interface EventoAssinatura {
  /** id da notificação do MP (idempotência). */
  eventId: string;
  /** preapproval_id da assinatura no MP. */
  preapprovalIdMp: string;
  tipo: TipoEventoAssinatura;
  /** Motivo do cancelamento (só em `cancelled`). */
  motivo?: string;
}

/** Status de domínio resultante de cada tipo de evento. */
const STATUS_POR_TIPO: Record<TipoEventoAssinatura, StatusAssinatura> = {
  created: "PENDENTE",
  authorized: "ATIVA",
  paused: "PAUSADA",
  cancelled: "CANCELADA",
  payment_failed: "INADIMPLENTE",
  payment_recovered: "ATIVA",
};

export interface ProcessarEventoDeps {
  repo: AssinaturaRepo;
  /**
   * Gancho de notificação de falha de pagamento. O envio real (WhatsApp) é do
   * slice #58; aqui só expomos o ponto de extensão (default no-op).
   */
  notificarFalha?: (preapprovalIdMp: string) => void;
}

export interface ProcessarEventoResultado {
  /** `true` se o evento foi aplicado; `false` se duplicado (idempotência). */
  aplicado: boolean;
}

/**
 * Caso de uso do webhook de assinaturas: registra o evento de forma idempotente
 * e reflete o status no banco. Evento duplicado (mesmo `event_id`) não reaplica.
 */
export async function processarEventoAssinatura(
  evento: EventoAssinatura,
  deps: ProcessarEventoDeps,
  agora: Date = new Date(),
): Promise<ProcessarEventoResultado> {
  const inserido = await deps.repo.registrarEvento({
    eventId: evento.eventId,
    preapprovalIdMp: evento.preapprovalIdMp,
    tipo: evento.tipo,
  });
  if (!inserido) return { aplicado: false };

  const patch: PatchAssinatura = { status: STATUS_POR_TIPO[evento.tipo] };
  if (evento.tipo === "cancelled") {
    patch.canceladoEm = agora;
    patch.motivoCancelamento = evento.motivo;
  }

  await deps.repo.atualizarStatus(evento.preapprovalIdMp, patch);
  if (evento.tipo === "payment_failed") {
    deps.notificarFalha?.(evento.preapprovalIdMp);
  }
  return { aplicado: true };
}
