import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import type { GatewayPagamento } from "./gateway";
import type { RecursoPagamentoMP } from "./webhook";

/**
 * Constrói o gateway real do Mercado Pago a partir das credenciais de ambiente.
 * `MP_ACCESS_TOKEN` separa sandbox (token TEST-) de produção; rotacionar a
 * credencial = trocar a env e reimplantar (ver doc do PR).
 */
export function criarGatewayMercadoPago(): GatewayPagamento {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não configurada");
  }
  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);
  const payment = new Payment(client);

  return {
    async criarPreferencia(req) {
      const resp = await preference.create({ body: req });
      return {
        id: String(resp.id),
        init_point: resp.init_point ?? "",
      };
    },

    async criarPagamentoPix(req) {
      const resp = await payment.create({
        body: {
          transaction_amount: req.transaction_amount,
          description: req.description,
          payment_method_id: "pix",
          metadata: req.metadata,
          // O MP exige um pagador; no fluxo headless usamos um placeholder
          // que as slices de UI substituem pelos dados reais do cliente.
          payer: { email: "cliente@dbg.eletrica.br" },
        },
      });
      return {
        id: String(resp.id),
        point_of_interaction: {
          transaction_data: {
            qr_code_base64:
              resp.point_of_interaction?.transaction_data?.qr_code_base64 ?? "",
            qr_code:
              resp.point_of_interaction?.transaction_data?.qr_code ?? "",
          },
        },
      };
    },

    async buscarPagamento(paymentId): Promise<RecursoPagamentoMP> {
      const resp = await payment.get({ id: paymentId });
      return {
        id: String(resp.id),
        status: resp.status ?? "unknown",
        transaction_amount: resp.transaction_amount ?? 0,
        payment_method_id: resp.payment_method_id ?? "unknown",
        metadata: resp.metadata as RecursoPagamentoMP["metadata"],
      };
    },
  };
}
