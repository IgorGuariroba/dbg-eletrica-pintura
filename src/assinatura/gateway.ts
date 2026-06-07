/** Requisição de criação de pre-approval (assinatura recorrente) no MP. */
export interface CriarAssinaturaReq {
  /** preApprovalPlanId do MP (template de cobrança do plano). */
  preapprovalPlanIdMp: string;
  /** E-mail do pagador (cliente). */
  payerEmail: string;
  /** Referência externa para correlação (ex: assinatura.id do DBG). */
  externalReference: string;
  /** URL de retorno após o checkout. */
  backUrl: string;
}

export interface CriarAssinaturaResp {
  preapprovalIdMp: string;
  /** URL de checkout do MP. */
  initPoint: string;
  /** Status cru devolvido pelo MP. */
  status: string;
}

/** Recurso de pre-approval consultado por id. */
export interface RecursoAssinaturaMP {
  id: string;
  status: string;
  externalReference?: string;
  nextPaymentDate?: string;
}

/**
 * Porta de saída para a Subscriptions API do Mercado Pago. Isola o SDK do
 * domínio: os casos de uso dependem desta interface (testável com fake).
 */
export interface GatewayAssinatura {
  criarAssinatura(req: CriarAssinaturaReq): Promise<CriarAssinaturaResp>;
  pausarAssinatura(preapprovalId: string): Promise<void>;
  cancelarAssinatura(preapprovalId: string, motivo: string): Promise<void>;
  /**
   * Atualiza o valor recorrente (upgrade/downgrade). O MP **não** permite trocar
   * o `preapproval_plan_id` de um pre-approval existente — só o `auto_recurring`
   * (valor/moeda). A lógica de upgrade/downgrade por plano é do slice #58, que
   * resolve o novo valor a partir do plano destino e chama este método.
   */
  atualizarAssinatura(
    preapprovalId: string,
    novoValor: number,
    moeda?: string,
  ): Promise<void>;
  buscarAssinatura(preapprovalId: string): Promise<RecursoAssinaturaMP>;
}
