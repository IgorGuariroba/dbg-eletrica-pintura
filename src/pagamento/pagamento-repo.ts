export interface RegistroPagamento {
  paymentId: string;
  osId: string;
  valor: string;
  metodo: string;
  status: string;
  observacao?: string;
}

export interface PagamentoRepo {
  /**
   * Registra o pagamento de uma OS. Idempotente pela PK (payment_id, os_id):
   * retorna `true` se inseriu agora, `false` se já existia (webhook duplicado).
   */
  registrar(p: RegistroPagamento): Promise<boolean>;
  /**
   * Processa a concessão de crédito de referral (indicação) caso aplicável.
   */
  processarReferralPosPagamento(osId: string): Promise<void>;
  /**
   * Consome o saldo de crédito de indicação do cliente de forma atômica e idempotente.
   */
  consumirCredito(paymentId: string, clienteId: string, valor: string): Promise<void>;
}

