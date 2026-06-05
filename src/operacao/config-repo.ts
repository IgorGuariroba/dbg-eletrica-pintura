import type { HorarioComercial } from "./horario-comercial";

export interface OperacaoConfig {
  precoLitro: string;
  kmPorLitro: string;
  horarioComercial: HorarioComercial;
  googleReviewUrl?: string | null;
}

export interface OperacaoConfigRepo {
  /** Lê a config (linha única). Cria com defaults se ainda não existe. */
  obter(): Promise<OperacaoConfig>;
  /** Atualiza preço do litro, km por litro e horário comercial. */
  atualizar(config: OperacaoConfig): Promise<OperacaoConfig>;
}
