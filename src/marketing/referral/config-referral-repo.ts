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

// ============================================================
// Implementação Drizzle (inlinada — auditoria #165: seam hipotético,
// um adapter só; regra e query juntas no módulo de domínio)
// ============================================================

import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { configReferral } from "@/db/schema";

export function criarConfigReferralRepoDrizzle(db: DB): ConfigReferralRepo {
  return {
    async obter(): Promise<ConfigReferral> {
      const [row] = await db
        .select({
          ativo: configReferral.ativo,
          valorPremio: configReferral.valorPremio,
        })
        .from(configReferral)
        .where(eq(configReferral.id, "default"))
        .limit(1);
      return {
        ativo: row?.ativo ?? CONFIG_REFERRAL_PADRAO.ativo,
        valorPremio: row?.valorPremio ?? CONFIG_REFERRAL_PADRAO.valorPremio,
      };
    },

    async salvar(config: ConfigReferral): Promise<void> {
      // Upsert pela PK fixa "default": a config é uma linha única.
      await db
        .insert(configReferral)
        .values({
          id: "default",
          ativo: config.ativo,
          valorPremio: config.valorPremio,
        })
        .onConflictDoUpdate({
          target: configReferral.id,
          set: { ativo: config.ativo, valorPremio: config.valorPremio },
        });
    },
  };
}
