export interface ConsumirInput {
  /** Identidade do consumidor, ex.: `cep:189.45.1.10`. */
  chave: string;
  /** Máximo de consumos permitidos dentro da janela. */
  limite: number;
  janelaMs: number;
  agora?: Date;
}

export interface ResultadoConsumo {
  permitido: boolean;
}

export interface RateLimitRepo {
  /**
   * Registra um consumo e responde se ele cabe na janela atual.
   * Janela fixa: expira `janelaMs` após o primeiro consumo registrado.
   */
  consumir(input: ConsumirInput): Promise<ResultadoConsumo>;
}
