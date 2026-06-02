import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Funções puras do webhook da WhatsApp Cloud API. A Meta assina o corpo bruto
 * com HMAC-SHA256 e o App Secret, enviando `X-Hub-Signature-256: sha256=<hex>`.
 * Recalculamos e comparamos em tempo constante (análogo a `pagamento/webhook`).
 */

export interface ValidarAssinaturaParams {
  /** Corpo bruto da requisição (string exata recebida). */
  payload: string;
  /** Header `X-Hub-Signature-256` (formato `sha256=<hex>`). */
  assinatura: string;
  /** App Secret da Meta (env `META_APP_SECRET`). */
  secret: string;
}

export function validarAssinatura(params: ValidarAssinaturaParams): boolean {
  const { payload, assinatura, secret } = params;
  const [esquema, hex] = assinatura.split("=");
  if (esquema !== "sha256" || !hex) return false;

  const esperado = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(hex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Atualização de status de uma mensagem enviada (delivered/read/failed). */
export interface EventoStatus {
  messageId: string;
  status: "enviado" | "entregue" | "lido" | "falhou";
}

const MAPA_STATUS: Record<string, EventoStatus["status"]> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhou",
};

interface StatusBruto {
  id?: string;
  status?: string;
}

interface PayloadWebhook {
  entry?: { changes?: { value?: { statuses?: StatusBruto[] } }[] }[];
}

/** Converte um status bruto da Meta em evento conhecido, ou `null` se irrelevante. */
function normalizarStatus(s: StatusBruto): EventoStatus | null {
  const status = s.status ? MAPA_STATUS[s.status] : undefined;
  return s.id && status ? { messageId: s.id, status } : null;
}

/**
 * Extrai as atualizações de status de um payload de webhook da Cloud API.
 * Ignora mensagens recebidas e campos desconhecidos — só status interessam
 * para correlacionar com o registro de envio. Robusto a forma parcial.
 */
export function parsearEventosStatus(payload: unknown): EventoStatus[] {
  return ((payload as PayloadWebhook | null)?.entry ?? [])
    .flatMap((entrada) => entrada.changes ?? [])
    .flatMap((mudanca) => mudanca.value?.statuses ?? [])
    .map(normalizarStatus)
    .filter((e): e is EventoStatus => e !== null);
}
