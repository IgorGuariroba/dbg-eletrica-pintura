import type { ContextoOs, TransicaoRegistro } from "./maquina-estado";

export interface TransicaoRepo {
  /**
   * Carrega o contexto da OS para a máquina: tipo, estado atual e o histórico
   * de estados já percorridos (derivado das transições registradas).
   */
  carregarContexto(osId: string): Promise<ContextoOs | null>;

  /**
   * Aplica a transição atomicamente: registra a linha de histórico e atualiza
   * o estado da OS.
   */
  persistir(osId: string, registro: TransicaoRegistro): Promise<void>;
}

export class OsInexistenteError extends Error {
  readonly status = 404;
  constructor() {
    super("OS não encontrada");
    this.name = "OsInexistenteError";
  }
}
