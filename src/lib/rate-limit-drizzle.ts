import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { rateLimit } from "@/db/schema";
import type { RateLimitRepo } from "./rate-limit";

export function criarRateLimitRepoDrizzle(db: DB): RateLimitRepo {
  return {
    async consumir({ chave, limite, janelaMs, agora = new Date() }) {
      // Upsert atômico: incrementa na janela vigente ou reinicia se expirou.
      // Atômico por linha — seguro entre instâncias serverless concorrentes.
      const corte = new Date(agora.getTime() - janelaMs);
      const [linha] = await db
        .insert(rateLimit)
        .values({ chave, janelaInicio: agora, contagem: 1 })
        .onConflictDoUpdate({
          target: rateLimit.chave,
          set: {
            contagem: sql`CASE WHEN ${rateLimit.janelaInicio} <= ${corte} THEN 1 ELSE ${rateLimit.contagem} + 1 END`,
            janelaInicio: sql`CASE WHEN ${rateLimit.janelaInicio} <= ${corte} THEN excluded.janela_inicio ELSE ${rateLimit.janelaInicio} END`,
          },
        })
        .returning({ contagem: rateLimit.contagem });
      return { permitido: linha.contagem <= limite };
    },
  };
}
