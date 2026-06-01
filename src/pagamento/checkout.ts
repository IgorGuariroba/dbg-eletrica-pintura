import type { GatewayPagamento } from "./gateway";

export interface ItemCheckout {
  titulo: string;
  quantidade: number;
  /** Preço unitário em reais como string decimal (ex: "250.00"). */
  precoUnitario: string;
}

export interface CheckoutProResult {
  url: string;
  preferenciaId: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Cria uma preferência de Checkout Pro no Mercado Pago. O metadata carrega a(s)
 * OS (`os_id` ou `os_ids`) para o webhook mapear o pagamento de volta.
 */
export async function criarPreferenciaCheckoutPro(
  gateway: GatewayPagamento,
  params: { items: ItemCheckout[]; metadata: Record<string, unknown> },
): Promise<CheckoutProResult> {
  const base = siteUrl();
  const resp = await gateway.criarPreferencia({
    items: params.items.map((i, idx) => ({
      id: `item-${idx + 1}`,
      title: i.titulo,
      quantity: i.quantidade,
      unit_price: Number(i.precoUnitario),
      currency_id: "BRL",
    })),
    metadata: params.metadata,
    back_urls: {
      success: `${base}/pagamento/sucesso`,
      failure: `${base}/pagamento/falha`,
    },
    auto_return: "approved",
  });

  return { url: resp.init_point, preferenciaId: resp.id };
}

export interface CobrancaPixResult {
  qrBase64: string;
  copiaCola: string;
  transacaoId: string;
}

/**
 * Cria uma cobrança Pix no Mercado Pago e devolve o QR (base64), o texto
 * copia-e-cola e o id da transação.
 */
export async function criarCobrancaPix(
  gateway: GatewayPagamento,
  params: {
    valor: string;
    descricao: string;
    metadata: Record<string, unknown>;
  },
): Promise<CobrancaPixResult> {
  const resp = await gateway.criarPagamentoPix({
    transaction_amount: Number(params.valor),
    description: params.descricao,
    metadata: params.metadata,
  });

  const dados = resp.point_of_interaction.transaction_data;
  return {
    qrBase64: dados.qr_code_base64,
    copiaCola: dados.qr_code,
    transacaoId: String(resp.id),
  };
}
