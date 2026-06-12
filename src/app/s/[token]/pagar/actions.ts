"use server";

import { montarCobrancaConsolidada } from "@/pagamento/montar-cobranca";

export async function pagarOsAction(token: string, osId: string) {
  try {
    return await montarCobrancaConsolidada(token, { tipo: "os", osId });
  } catch (e) {
    console.error("Erro ao gerar preferência de pagamento:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}

export async function pagarTudoAction(token: string) {
  try {
    return await montarCobrancaConsolidada(token, { tipo: "tudo" });
  } catch (e) {
    console.error("Erro ao gerar preferência consolidada:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}

/**
 * Combo do upsell (issue #65): paga as OS pendentes e a 1ª mensalidade do
 * plano numa preferência única. A assinatura nasce PENDENTE sem pre-approval;
 * o webhook de pagamentos ativa OS + assinatura quando o MP aprovar.
 */
export async function pagarTudoComAssinaturaAction(
  token: string,
  planoSlug: string,
) {
  try {
    return await montarCobrancaConsolidada(token, { tipo: "combo", planoSlug });
  } catch (e) {
    console.error("Erro ao gerar preferência combinada:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}
