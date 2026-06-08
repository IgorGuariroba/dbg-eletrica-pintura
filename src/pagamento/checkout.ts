import type { GatewayPagamento } from "./gateway";
import type { EstadoOs } from "@/operacao/orcamento-repo";
import { podeCobrar } from "@/operacao/estado-predicados";

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

export interface OrdemCheckout {
  osId: string;
  categoria: string;
  estado: EstadoOs;
  total: string;
  pago: boolean;
}

export interface CheckoutConsolidado {
  pagaveis: { osId: string; total: string; categoria: string }[];
  pagas: { osId: string; total: string; categoria: string }[];
  somaPagavel: string;
  osIds: string[];
  podePagarTudo: boolean;
}

export function montarCheckoutConsolidado(
  ordens: OrdemCheckout[],
): CheckoutConsolidado {
  const pagaveis: { osId: string; total: string; categoria: string }[] = [];
  const pagas: { osId: string; total: string; categoria: string }[] = [];
  let somaCents = 0;

  for (const o of ordens) {
    if (podeCobrar(o.estado) && !o.pago) {
      pagaveis.push({ osId: o.osId, total: o.total, categoria: o.categoria });
      somaCents += Math.round(parseFloat(o.total) * 100);
    } else if (o.estado === "PAGA" || o.pago) {
      pagas.push({ osId: o.osId, total: o.total, categoria: o.categoria });
    }
  }

  const somaPagavel = (somaCents / 100).toFixed(2);
  const osIds = pagaveis.map((p) => p.osId);
  const podePagarTudo = pagaveis.length > 0;

  return {
    pagaveis,
    pagas,
    somaPagavel,
    osIds,
    podePagarTudo,
  };
}

