import { and, avg, count, eq, isNotNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import { avaliacao, membro } from "@/db/schema";
import type { NotaTecnicoRepo, NotaTecnicoView } from "./nota-tecnico-repo";

export function criarNotaTecnicoRepoDrizzle(db: DB): NotaTecnicoRepo {
  return {
    async obterNotaMedia(tecnicoId) {
      const [row] = await db
        .select({
          media: avg(avaliacao.nota),
          total: count(avaliacao.id),
        })
        .from(avaliacao)
        .where(
          and(
            eq(avaliacao.tecnicoId, tecnicoId),
            eq(avaliacao.invalida, false),
          )
        );

      if (!row) return null;

      return {
        media: row.media !== null ? parseFloat(row.media) : null,
        total: row.total,
      };
    },

    async obterNotaMediaGlobal() {
      const [row] = await db
        .select({
          media: avg(avaliacao.nota),
          total: count(avaliacao.id),
        })
        .from(avaliacao)
        .where(eq(avaliacao.invalida, false));

      return {
        media: row?.media != null ? parseFloat(row.media) : null,
        total: row?.total ?? 0,
      };
    },

    async listarNotasPorTecnico() {
      const rows = await db
        .select({
          tecnicoId: avaliacao.tecnicoId,
          tecnicoNome: membro.nome,
          media: avg(avaliacao.nota),
          total: count(avaliacao.id),
        })
        .from(avaliacao)
        .leftJoin(membro, eq(avaliacao.tecnicoId, membro.id))
        .where(
          and(
            isNotNull(avaliacao.tecnicoId),
            eq(avaliacao.invalida, false),
          )
        )
        .groupBy(avaliacao.tecnicoId, membro.nome);

      return rows
        .filter((r): r is typeof r & { tecnicoId: string } => r.tecnicoId !== null)
        .map((r) => ({
          tecnicoId: r.tecnicoId,
          tecnicoNome: r.tecnicoNome ?? null,
          media: r.media !== null ? parseFloat(r.media) : null,
          total: r.total,
        })) satisfies NotaTecnicoView[];
    },
  };
}
