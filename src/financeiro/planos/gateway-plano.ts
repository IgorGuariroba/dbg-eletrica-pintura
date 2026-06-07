/** Dados p/ criar o template de cobrança recorrente (PreApprovalPlan) no MP. */
export interface CriarPlanoCobrancaReq {
  nome: string;
  /** Valor mensal em reais (ex: "149.90"). */
  preco: string;
}

export interface CriarPlanoCobrancaResp {
  /** preapproval_plan_id devolvido pelo MP. */
  preapprovalPlanIdMp: string;
}

/**
 * Porta de saída para os templates de cobrança (PreApprovalPlan) da
 * Subscriptions API do MP. Separada de `GatewayAssinatura` (que lida com o
 * pre-approval por cliente): aqui criamos o plano que o slice #3 referencia.
 */
export interface GatewayPlanoMP {
  criarPlanoCobranca(req: CriarPlanoCobrancaReq): Promise<CriarPlanoCobrancaResp>;
}
