import type { TipoEventoAssinatura } from "./processar-evento";

/**
 * Deriva o tipo de evento de domínio a partir do status do pre-approval
 * consultado no MP (o webhook só traz `data.id`; o status vem da consulta —
 * mesmo padrão do webhook de pagamento).
 *
 * Eventos de pagamento recorrente (`payment_failed`/`payment_recovered`) são
 * tratados pelo caso de uso; aqui mapeamos o ciclo de vida do pre-approval.
 * Status desconhecido devolve `null` (ignorado, sem efeito).
 */
export function derivarTipoEvento(
  mpStatus: string,
): TipoEventoAssinatura | null {
  switch (mpStatus) {
    case "pending":
      return "created";
    case "authorized":
      return "authorized";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}
