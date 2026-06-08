import { MercadoPagoConfig, PreApprovalPlan } from "mercadopago";
import type { GatewayPlanoMP } from "./gateway-plano";

/**
 * Gateway real de templates de cobrança (PreApprovalPlan) do Mercado Pago.
 * Cria um plano recorrente mensal em BRL. `MP_ACCESS_TOKEN` é compartilhado com
 * o fluxo de assinatura/pagamento (mesma conta — TEST-/APP_USR-).
 */
export function criarGatewayMercadoPagoPlano(): GatewayPlanoMP {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não configurada");
  }
  const client = new MercadoPagoConfig({ accessToken });
  const preapprovalPlan = new PreApprovalPlan(client);
  // `back_url` é persistida no template do MP e usada como retorno do checkout
  // do plano — precisa ser uma URL pública real. Fail-closed: sem
  // NEXT_PUBLIC_SITE_URL não publicamos um plano apontando para localhost.
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL não configurada — necessária para a back_url do plano",
    );
  }
  const backUrl = `${site}/planos`;

  return {
    async criarPlanoCobranca(req) {
      const resp = await preapprovalPlan.create({
        body: {
          reason: req.nome,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: Number(req.preco),
            currency_id: "BRL",
          },
          back_url: backUrl,
        },
      });
      return { preapprovalPlanIdMp: String(resp.id) };
    },
  };
}
