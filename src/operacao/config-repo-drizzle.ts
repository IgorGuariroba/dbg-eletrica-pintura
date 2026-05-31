import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { operacaoConfig } from "@/db/schema";
import type { OperacaoConfig, OperacaoConfigRepo } from "./config-repo";
import { HORARIO_COMERCIAL_PADRAO, type HorarioComercial } from "./horario-comercial";

const SINGLETON = "default";

const COLUNAS = {
  precoLitro: operacaoConfig.precoLitro,
  kmPorLitro: operacaoConfig.kmPorLitro,
  horarioComercial: operacaoConfig.horarioComercial,
};

type Linha = {
  precoLitro: string;
  kmPorLitro: string;
  horarioComercial: HorarioComercial | null;
};

// Linha nunca configurada (jsonb null) cai no horário comercial de fábrica.
function materializar(row: Linha): OperacaoConfig {
  return {
    precoLitro: row.precoLitro,
    kmPorLitro: row.kmPorLitro,
    horarioComercial: row.horarioComercial ?? HORARIO_COMERCIAL_PADRAO,
  };
}

export function criarOperacaoConfigRepoDrizzle(db: DB): OperacaoConfigRepo {
  return {
    async obter(): Promise<OperacaoConfig> {
      // Caminho quente: leitura pura, sem escrita.
      const [row] = await db
        .select(COLUNAS)
        .from(operacaoConfig)
        .where(eq(operacaoConfig.id, SINGLETON))
        .limit(1);
      if (row) return materializar(row);

      // Caminho frio (linha ainda não materializada): upsert-returning sempre
      // devolve o registro — mesmo sob corrida — então nunca retorna undefined.
      const [criada] = await db
        .insert(operacaoConfig)
        .values({ id: SINGLETON })
        .onConflictDoUpdate({ target: operacaoConfig.id, set: { id: SINGLETON } })
        .returning(COLUNAS);
      return materializar(criada);
    },

    async atualizar(config: OperacaoConfig): Promise<OperacaoConfig> {
      const valores = {
        precoLitro: config.precoLitro,
        kmPorLitro: config.kmPorLitro,
        horarioComercial: config.horarioComercial,
      };
      const [row] = await db
        .insert(operacaoConfig)
        .values({ id: SINGLETON, ...valores })
        .onConflictDoUpdate({ target: operacaoConfig.id, set: valores })
        .returning(COLUNAS);
      return materializar(row);
    },
  };
}
