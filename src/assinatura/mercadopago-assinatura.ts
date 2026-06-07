import { MercadoPagoConfig, PreApproval } from "mercadopago";
import type { GatewayAssinatura } from "./gateway";

/**
 * Constrói o gateway real da Subscriptions API do Mercado Pago a partir das
 * credenciais de ambiente. `MP_ACCESS_TOKEN` é compartilhado com o fluxo de
 * pagamento avulso (mesma conta MP — TEST- = sandbox, APP_USR- = produção).
 */
export function criarGatewayMercadoPagoAssinatura(): GatewayAssinatura {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não configurada");
  }
  const client = new MercadoPagoConfig({ accessToken });
  const preapproval = new PreApproval(client);

  return {
    async criarAssinatura(req) {
      const resp = await preapproval.create({
        body: {
          preapproval_plan_id: req.preapprovalPlanIdMp,
          payer_email: req.payerEmail,
          external_reference: req.externalReference,
          back_url: req.backUrl,
        },
      });
      return {
        preapprovalIdMp: String(resp.id),
        initPoint: resp.init_point ?? "",
        status: resp.status ?? "pending",
      };
    },

    async pausarAssinatura(preapprovalId) {
      await preapproval.update({
        id: preapprovalId,
        body: { status: "paused" },
      });
    },

    async cancelarAssinatura(preapprovalId) {
      await preapproval.update({
        id: preapprovalId,
        body: { status: "cancelled" },
      });
    },

    async atualizarAssinatura(preapprovalId, novoValor, moeda = "BRL") {
      await preapproval.update({
        id: preapprovalId,
        body: {
          auto_recurring: { transaction_amount: novoValor, currency_id: moeda },
        },
      });
    },

    async buscarAssinatura(preapprovalId) {
      const resp = await preapproval.get({ id: preapprovalId });
      return {
        id: String(resp.id),
        status: resp.status ?? "unknown",
        externalReference: resp.external_reference ?? undefined,
        nextPaymentDate: resp.next_payment_date ?? undefined,
      };
    },
  };
}
