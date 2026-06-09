/** Configuração da campanha de Indicação Dupla (Referral Loop). */
export interface ConfigReferral {
  /** Campanha ativa? Inativa zera prêmio e desconto na prática. */
  ativo: boolean;
  /** Valor em reais do prêmio/crédito e do desconto do indicado. */
  valorPremio: string;
}

export interface ConfigReferralRepo {
  /** Lê a configuração da campanha (linha única `default`). */
  obter(): Promise<ConfigReferral>;
  /** Cria ou atualiza a configuração da campanha. */
  salvar(config: ConfigReferral): Promise<void>;
}

/** Valores padrão quando ainda não há linha de config persistida. */
export const CONFIG_REFERRAL_PADRAO: ConfigReferral = {
  ativo: true,
  valorPremio: "30.00",
};
