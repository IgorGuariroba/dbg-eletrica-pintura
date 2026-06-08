import { asc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { osChecklistResultado } from "@/db/schema";
import type {
  ChecklistResultadoRepo,
  ResultadoChecklist,
} from "./checklist-resultado-repo";

export function criarChecklistResultadoRepoDrizzle(
  db: DB,
): ChecklistResultadoRepo {
  return {
    async salvarResultados(linhas: ResultadoChecklist[]) {
      if (linhas.length === 0) return;
      await db
        .insert(osChecklistResultado)
        .values(linhas)
        .onConflictDoUpdate({
          target: [osChecklistResultado.osId, osChecklistResultado.itemId],
          set: {
            descricaoSnapshot: sqlExcluded("descricao_snapshot"),
            status: sqlExcluded("status"),
            observacao: sqlExcluded("observacao"),
            fotoUrl: sqlExcluded("foto_url"),
          },
        });
    },
    async listarPorOs(osId: string) {
      const linhas = await db
        .select()
        .from(osChecklistResultado)
        .where(eq(osChecklistResultado.osId, osId))
        .orderBy(asc(osChecklistResultado.criadoEm));
      return linhas.map((r) => ({
        osId: r.osId,
        itemId: r.itemId,
        descricaoSnapshot: r.descricaoSnapshot,
        status: r.status,
        observacao: r.observacao,
        fotoUrl: r.fotoUrl,
      }));
    },
  };
}

/** Referência a `excluded.<coluna>` no UPSERT (valor que teria sido inserido). */
function sqlExcluded(coluna: string) {
  return sql.raw(`excluded.${coluna}`);
}
