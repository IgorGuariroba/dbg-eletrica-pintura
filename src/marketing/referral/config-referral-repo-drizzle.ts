import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { configReferral } from "@/db/schema";
import {
  CONFIG_REFERRAL_PADRAO,
  type ConfigReferral,
  type ConfigReferralRepo,
} from "./config-referral-repo";

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
