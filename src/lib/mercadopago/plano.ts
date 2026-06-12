import { PreApprovalPlan } from "mercadopago";
import type { GatewayPlanoMP } from "@/financeiro/planos/gateway-plano";
import { chamarMp, criarClienteMp, MercadoPagoError } from "./cliente";

/**
 * Gateway real de templates de cobrança (PreApprovalPlan) do Mercado Pago.
 * Cria um plano recorrente mensal em BRL. Implementa a interface do contexto
 * Financeiro/Planos.
 */
export function criarGatewayMercadoPagoPlano(): GatewayPlanoMP {
  const client = criarClienteMp();
  const preapprovalPlan = new PreApprovalPlan(client);
  // `back_url` é persistida no template do MP e usada como retorno do checkout
  // do plano — precisa ser uma URL pública real. Fail-closed: sem
  // NEXT_PUBLIC_SITE_URL não publicamos um plano apontando para localhost.
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) {
    throw new MercadoPagoError(
      "NEXT_PUBLIC_SITE_URL não configurada — necessária para a back_url do plano",
    );
  }
  const backUrl = `${site}/planos`;

  return {
    async criarPlanoCobranca(req) {
      const resp = await chamarMp("criar plano de cobrança", () =>
        preapprovalPlan.create({
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
        }),
      );
      return { preapprovalPlanIdMp: String(resp.id) };
    },
  };
}
