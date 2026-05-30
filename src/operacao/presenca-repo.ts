export interface ConfirmacaoPresenca {
  ip: string;
  confirmadoEm: Date;
}

export interface PresencaRepo {
  /**
   * Registra a confirmação de presença da OS de forma idempotente: a primeira
   * gravação vence (ip/timestamp). Retorna se já existia uma confirmação.
   */
  confirmar(osId: string, ip: string): Promise<{ jaConfirmado: boolean }>;
  /** Lê a confirmação da OS, se houver. */
  buscar(osId: string): Promise<ConfirmacaoPresenca | null>;
}
