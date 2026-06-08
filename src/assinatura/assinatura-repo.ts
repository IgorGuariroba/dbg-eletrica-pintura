/** Status normalizado da assinatura (espelha `statusAssinaturaEnum`). */
export type StatusAssinatura =
  | "PENDENTE"
  | "ATIVA"
  | "PAUSADA"
  | "CANCELADA"
  | "INADIMPLENTE";

/** Evento de webhook a registrar para idempotência. */
export interface RegistroEventoAssinatura {
  eventId: string;
  preapprovalIdMp: string;
  tipo: string;
}

/** Campos atualizáveis ao aplicar um evento ao estado da assinatura. */
export interface PatchAssinatura {
  status: StatusAssinatura;
  inicio?: Date;
  fimCicloAtual?: Date;
  canceladoEm?: Date;
  motivoCancelamento?: string;
}

/** Dados para criar a linha de assinatura no estado inicial. */
export interface NovaAssinatura {
  clienteId: string;
  planoId: string;
  preapprovalIdMp: string;
}

export interface AssinaturaRepo {
  /** Cria a assinatura (status default PENDENTE). Retorna o id gerado. */
  criar(a: NovaAssinatura): Promise<{ id: string }>;
  /**
   * Registra o evento de webhook. Idempotente pela PK `event_id`:
   * retorna `true` se inseriu agora, `false` se já existia (evento duplicado).
   */
  registrarEvento(e: RegistroEventoAssinatura): Promise<boolean>;
  /** Aplica o patch de estado à assinatura identificada pelo preapproval. */
  atualizarStatus(
    preapprovalIdMp: string,
    patch: PatchAssinatura,
  ): Promise<void>;
  /**
   * Status atual da assinatura antes de aplicar um evento. Usado para detectar a
   * 1ª ativação (PENDENTE → ATIVA) e disparar boas-vindas só uma vez. Opcional:
   * repositórios/fakes que não precisam disso são tratados como `null`.
   */
  statusAtual?(preapprovalIdMp: string): Promise<StatusAssinatura | null>;
  /**
   * `true` se o cliente já tem uma assinatura ATIVA (ou PENDENTE) deste plano —
   * evita criar pre-approval duplicado (cobrança dupla) ao reassinar. Opcional:
   * fakes que não exercitam esse caminho são tratados como "não tem".
   */
  assinaturaAtivaDe?(clienteId: string, planoId: string): Promise<boolean>;
}
