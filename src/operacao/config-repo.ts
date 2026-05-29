export interface OperacaoConfig {
  precoLitro: string;
  kmPorLitro: string;
}

export interface OperacaoConfigRepo {
  /** Lê a config (linha única). Cria com defaults se ainda não existe. */
  obter(): Promise<OperacaoConfig>;
  /** Atualiza preço do litro e km por litro. */
  atualizar(config: OperacaoConfig): Promise<OperacaoConfig>;
}
