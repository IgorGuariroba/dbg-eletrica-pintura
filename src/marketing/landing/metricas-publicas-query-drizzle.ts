import { and, count, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { avaliacao, transicaoOs } from "@/db/schema";
import type {
  MetricasPublicas,
  MetricasPublicasQuery,
} from "./metricas-publicas-query";

export function criarMetricasPublicasQueryDrizzle(
  db: DB,
): MetricasPublicasQuery {
  return {
    async obter(): Promise<MetricasPublicas> {
      // OS concluída = teve ao menos uma transição para CONCLUIDA (mesma
      // âncora usada pelo dashboard admin, sem a janela de 30 dias).
      const [concluidas] = await db
        .select({
          value: sql<number>`count(distinct ${transicaoOs.osId})`,
        })
        .from(transicaoOs)
        .where(eq(transicaoOs.estadoNovo, "CONCLUIDA"));

      const [notas] = await db
        .select({
          media: sql<string | null>`avg(${avaliacao.nota})`,
          total: count(),
        })
        .from(avaliacao)
        .where(and(eq(avaliacao.invalida, false)));

      const media = notas.media == null ? null : Number(notas.media);
      return {
        osConcluidas: Number(concluidas.value),
        notaMedia: media != null && Number.isFinite(media) ? media : null,
        totalAvaliacoes: Number(notas.total),
      };
    },
  };
}
