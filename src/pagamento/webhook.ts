import { createHmac, timingSafeEqual } from "node:crypto";

export interface AssinaturaParams {
  /** `data.id` da notificação (query param ou corpo). */
  dataId: string;
  /** Header `x-request-id` da requisição. */
  requestId: string;
  /** Header `x-signature` no formato `ts=<ts>,v1=<hash>`. */
  xSignature: string;
  /** Segredo do webhook (env `MP_WEBHOOK_SECRET`). */
  secret: string;
}

/**
 * Valida a assinatura do webhook do Mercado Pago (esquema oficial).
 *
 * O MP envia `x-signature: ts=<ts>,v1=<hmac>` e assina o manifest
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256 e o
 * segredo do webhook. Recalculamos e comparamos em tempo constante.
 */
export function validarAssinatura(params: AssinaturaParams): boolean {
  const { dataId, requestId, xSignature, secret } = params;

  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [chave, ...resto] = p.split("=");
      return [chave.trim(), resto.join("=").trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Recurso de pagamento devolvido pelo Mercado Pago ao consultar por id. */
export interface RecursoPagamentoMP {
  id: number | string;
  status: string;
  transaction_amount: number;
  payment_method_id: string;
  metadata?: { os_id?: string; os_ids?: string[] };
}

/** Dados normalizados do pagamento, prontos para persistência. */
export interface DadosPagamento {
  paymentId: string;
  status: string;
  valor: string;
  metodo: string;
  osIds: string[];
}

/**
 * Normaliza o recurso de pagamento do MP. As OS afetadas vêm em
 * `metadata.os_id` (única) ou `metadata.os_ids` (checkout consolidado).
 */
export function parsearNotificacao(
  recurso: RecursoPagamentoMP,
): DadosPagamento {
  const osIds = recurso.metadata?.os_ids ??
    (recurso.metadata?.os_id ? [recurso.metadata.os_id] : []);
  if (osIds.length === 0) throw new MetadataOsAusenteError();

  return {
    paymentId: String(recurso.id),
    status: recurso.status,
    valor: recurso.transaction_amount.toFixed(2),
    metodo: recurso.payment_method_id,
    osIds,
  };
}

export class MetadataOsAusenteError extends Error {
  readonly status = 400;
  constructor() {
    super("Pagamento sem os_id/os_ids no metadata");
    this.name = "MetadataOsAusenteError";
  }
}
