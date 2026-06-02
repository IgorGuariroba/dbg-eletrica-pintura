/**
 * Horário Restrito da Notificação proativa: a Cloud API só dispara entre 8h e
 * 20h no fuso de São Paulo (ver CONTEXT.md). Fora dessa janela o envio entra na
 * Fila de Envio e sai às 8h. Função pura e relógio injetável — testável sem
 * depender do horário da máquina.
 */

const TZ = "America/Sao_Paulo";
const INICIO_HORA = 8; // inclusivo
const FIM_HORA = 20; // exclusivo (20h em diante = fora)

/** Hora cheia (0–23) de `data` no fuso de São Paulo. */
function horaEmSaoPaulo(data: Date): number {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(data);
  const hora = partes.find((p) => p.type === "hour")?.value ?? "0";
  // Intl pode devolver "24" à meia-noite em alguns ambientes; normaliza.
  return Number(hora) % 24;
}

/** `true` se `agora` está dentro da janela 8h–20h (São Paulo). */
export function dentroHorarioRestrito(agora: Date): boolean {
  const hora = horaEmSaoPaulo(agora);
  return hora >= INICIO_HORA && hora < FIM_HORA;
}
