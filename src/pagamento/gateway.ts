import type { RecursoPagamentoMP } from "./webhook";

/** Item de checkout no formato do Mercado Pago. */
export interface ItemMP {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface PreferenciaRequest {
  items: ItemMP[];
  metadata: Record<string, unknown>;
  back_urls?: { success: string; failure: string; pending?: string };
  auto_return?: string;
}

export interface PreferenciaResponse {
  id: string;
  init_point: string;
}

export interface PagamentoPixRequest {
  transaction_amount: number;
  description: string;
  metadata: Record<string, unknown>;
}

export interface PagamentoPixResponse {
  id: number | string;
  point_of_interaction: {
    transaction_data: { qr_code_base64: string; qr_code: string };
  };
}

/**
 * Porta de saída para o Mercado Pago. Isola o SDK do domínio: o checkout e o
 * processamento de webhook dependem desta interface (testável com fake).
 */
export interface GatewayPagamento {
  criarPreferencia(req: PreferenciaRequest): Promise<PreferenciaResponse>;
  criarPagamentoPix(req: PagamentoPixRequest): Promise<PagamentoPixResponse>;
  buscarPagamento(paymentId: string): Promise<RecursoPagamentoMP>;
}
