import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { operacaoConfig } from "@/db/schema";
import type { OperacaoConfig, OperacaoConfigRepo } from "./config-repo";

const SINGLETON = "default";

export function criarOperacaoConfigRepoDrizzle(db: DB): OperacaoConfigRepo {
  return {
    async obter(): Promise<OperacaoConfig> {
      const colunas = {
        precoLitro: operacaoConfig.precoLitro,
        kmPorLitro: operacaoConfig.kmPorLitro,
      };
      // Caminho quente: leitura pura, sem escrita.
      const [row] = await db
        .select(colunas)
        .from(operacaoConfig)
        .where(eq(operacaoConfig.id, SINGLETON))
        .limit(1);
      if (row) return row;

      // Caminho frio (linha ainda não materializada): upsert-returning sempre
      // devolve o registro — mesmo sob corrida — então nunca retorna undefined.
      const [criada] = await db
        .insert(operacaoConfig)
        .values({ id: SINGLETON })
        .onConflictDoUpdate({ target: operacaoConfig.id, set: { id: SINGLETON } })
        .returning(colunas);
      return criada;
    },

    async atualizar(config: OperacaoConfig): Promise<OperacaoConfig> {
      const [row] = await db
        .insert(operacaoConfig)
        .values({
          id: SINGLETON,
          precoLitro: config.precoLitro,
          kmPorLitro: config.kmPorLitro,
        })
        .onConflictDoUpdate({
          target: operacaoConfig.id,
          set: {
            precoLitro: config.precoLitro,
            kmPorLitro: config.kmPorLitro,
          },
        })
        .returning({
          precoLitro: operacaoConfig.precoLitro,
          kmPorLitro: operacaoConfig.kmPorLitro,
        });
      return row;
    },
  };
}
