import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { configRemarketing } from "@/db/schema";
import { GATILHOS_REMARKETING, type GatilhoRemarketingId } from "./gatilhos";
import type { ConfigRemarketing, ConfigRemarketingRepo } from "./config-repo";

export function criarConfigRemarketingRepoDrizzle(db: DB): ConfigRemarketingRepo {
  async function overridesMap(): Promise<Map<GatilhoRemarketingId, ConfigRemarketing>> {
    const linhas = await db.select().from(configRemarketing);
    const map = new Map<GatilhoRemarketingId, ConfigRemarketing>();
    for (const linha of linhas) {
      map.set(linha.gatilho as GatilhoRemarketingId, {
        gatilho: linha.gatilho as GatilhoRemarketingId,
        ativo: linha.ativo,
        prazosDias: linha.prazosDias,
        templateId: linha.templateId,
        atualizadoEm: linha.atualizadoEm,
      });
    }
    return map;
  }

  return {
    async listar() {
      const overrides = await overridesMap();
      const resultado: ConfigRemarketing[] = [];
      const chaves = Object.keys(GATILHOS_REMARKETING) as GatilhoRemarketingId[];
      for (const id of chaves) {
        const def = GATILHOS_REMARKETING[id];
        const ovr = overrides.get(id);
        resultado.push({
          gatilho: id,
          ativo: ovr ? ovr.ativo : def.ativoDefault,
          prazosDias: ovr ? ovr.prazosDias : def.prazosDefault,
          templateId: ovr ? ovr.templateId : def.templateDefault,
          atualizadoEm: ovr ? ovr.atualizadoEm : null,
        });
      }
      return resultado;
    },

    async obter(gatilho) {
      const [linha] = await db
        .select()
        .from(configRemarketing)
        .where(eq(configRemarketing.gatilho, gatilho))
        .limit(1);

      const def = GATILHOS_REMARKETING[gatilho];
      return {
        gatilho,
        ativo: linha ? linha.ativo : def.ativoDefault,
        prazosDias: linha ? linha.prazosDias : def.prazosDefault,
        templateId: linha ? linha.templateId : def.templateDefault,
        atualizadoEm: linha ? linha.atualizadoEm : null,
      };
    },

    async salvar(gatilho, dados) {
      await db
        .insert(configRemarketing)
        .values({
          gatilho,
          ativo: dados.ativo,
          prazosDias: dados.prazosDias,
          templateId: dados.templateId,
        })
        .onConflictDoUpdate({
          target: configRemarketing.gatilho,
          set: {
            ativo: dados.ativo,
            prazosDias: dados.prazosDias,
            templateId: dados.templateId,
          },
        });
    },

    async obterValidadeDias() {
      const config = await this.obter("validade_orcamento");
      return config.prazosDias[0] ?? 7;
    },
  };
}
