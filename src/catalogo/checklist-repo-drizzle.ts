import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { checklistPreventivoItem } from "@/db/schema";
import type {
  AtualizacaoChecklistItem,
  Categoria,
  ChecklistItem,
  ChecklistItemRepo,
  NovoChecklistItem,
} from "./checklist-repo";

function row(r: typeof checklistPreventivoItem.$inferSelect): ChecklistItem {
  return {
    id: r.id,
    categoria: r.categoria,
    ordem: r.ordem,
    descricao: r.descricao,
    exigeFoto: r.exigeFoto,
    ativo: r.ativo,
    criadoEm: r.criadoEm,
  };
}

export function criarChecklistItemRepoDrizzle(db: DB): ChecklistItemRepo {
  return {
    async inserir(n: NovoChecklistItem) {
      const [r] = await db
        .insert(checklistPreventivoItem)
        .values(n)
        .returning();
      return row(r);
    },
    async atualizar(id: string, mudancas: AtualizacaoChecklistItem) {
      if (Object.keys(mudancas).length === 0) {
        const [r] = await db
          .select()
          .from(checklistPreventivoItem)
          .where(eq(checklistPreventivoItem.id, id));
        return r ? row(r) : null;
      }
      const [r] = await db
        .update(checklistPreventivoItem)
        .set(mudancas)
        .where(eq(checklistPreventivoItem.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async remover(id: string) {
      const deletadas = await db
        .delete(checklistPreventivoItem)
        .where(eq(checklistPreventivoItem.id, id))
        .returning({ id: checklistPreventivoItem.id });
      return deletadas.length > 0;
    },
    async buscarPorId(id: string) {
      const [r] = await db
        .select()
        .from(checklistPreventivoItem)
        .where(eq(checklistPreventivoItem.id, id));
      return r ? row(r) : null;
    },
    async listarPorCategoria(categoria: Categoria) {
      const itens = await db
        .select()
        .from(checklistPreventivoItem)
        .where(eq(checklistPreventivoItem.categoria, categoria))
        .orderBy(asc(checklistPreventivoItem.ordem));
      return itens.map(row);
    },
  };
}
