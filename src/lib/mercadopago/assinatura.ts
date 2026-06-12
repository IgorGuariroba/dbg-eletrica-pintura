import { PreApproval } from "mercadopago";
import type { GatewayAssinatura } from "@/assinatura/gateway";
import { chamarMp, criarClienteMp } from "./cliente";

/**
 * Gateway real da Subscriptions API do Mercado Pago (PreApproval). Implementa
 * a interface do contexto Assinatura.
 */
export function criarGatewayMercadoPagoAssinatura(): GatewayAssinatura {
  const client = criarClienteMp();
  const preapproval = new PreApproval(client);

  return {
    async criarAssinatura(req) {
      const resp = await chamarMp("criar assinatura", () =>
        preapproval.create({
          body: {
            preapproval_plan_id: req.preapprovalPlanIdMp,
            payer_email: req.payerEmail,
            external_reference: req.externalReference,
            back_url: req.backUrl,
          },
        }),
      );
      return {
        preapprovalIdMp: String(resp.id),
        initPoint: resp.init_point ?? "",
        status: resp.status ?? "pending",
      };
    },

    async pausarAssinatura(preapprovalId) {
      await chamarMp("pausar assinatura", () =>
        preapproval.update({
          id: preapprovalId,
          body: { status: "paused" },
        }),
      );
    },

    async cancelarAssinatura(preapprovalId) {
      await chamarMp("cancelar assinatura", () =>
        preapproval.update({
          id: preapprovalId,
          body: { status: "cancelled" },
        }),
      );
    },

    async atualizarAssinatura(preapprovalId, novoValor, moeda = "BRL") {
      await chamarMp("atualizar assinatura", () =>
        preapproval.update({
          id: preapprovalId,
          body: {
            auto_recurring: { transaction_amount: novoValor, currency_id: moeda },
          },
        }),
      );
    },

    async buscarAssinatura(preapprovalId) {
      const resp = await chamarMp("buscar assinatura", () =>
        preapproval.get({ id: preapprovalId }),
      );
      return {
        id: String(resp.id),
        status: resp.status ?? "unknown",
        externalReference: resp.external_reference ?? undefined,
        nextPaymentDate: resp.next_payment_date ?? undefined,
      };
    },
  };
}
