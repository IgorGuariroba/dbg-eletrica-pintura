export interface RegistroPagamento {
  paymentId: string;
  osId: string;
  valor: string;
  metodo: string;
  status: string;
}

export interface PagamentoRepo {
  /**
   * Registra o pagamento de uma OS. Idempotente pela PK (payment_id, os_id):
   * retorna `true` se inseriu agora, `false` se já existia (webhook duplicado).
   */
  registrar(p: RegistroPagamento): Promise<boolean>;
}
