import type { EstadoOs } from "./fila-repo";

export interface ReativacaoRepo {
  /** Busca os dados essenciais da OS (id, estado e metadados) */
  buscarOs(osId: string): Promise<{
    id: string;
    estado: EstadoOs;
    metadados: any;
  } | null>;

  /**
   * Executa a reativação atômica no banco de dados:
   * 1. Atualiza o estado da OS para 'ORCADA'.
   * 2. Salva os novos metadados da OS (histórico de reativações).
   * 3. Atualiza a validade ('validoAte') do orçamento mais recente dessa OS para a nova data.
   */
  reativar(
    osId: string,
    novoEstado: "ORCADA",
    novosMetadados: any,
    novaValidade: Date,
  ): Promise<boolean>;
}

export class SemPermissaoError extends Error {
  readonly status = 403;
  constructor() {
    super("Apenas membros com módulo Operação podem reativar OS");
    this.name = "SemPermissaoError";
  }
}

export class OsInexistenteError extends Error {
  readonly status = 404;
  constructor() {
    super("OS não encontrada");
    this.name = "OsInexistenteError";
  }
}

export class EstadoInvalidoError extends Error {
  readonly status = 409;
  constructor() {
    super("Apenas OS nos estados REJEITADA ou EXPIRADA podem ser reativadas");
    this.name = "EstadoInvalidoError";
  }
}
