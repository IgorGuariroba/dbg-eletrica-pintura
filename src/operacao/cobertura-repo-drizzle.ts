import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { bairroCobertura } from "@/db/schema";
import { normalizarBairro } from "./cobertura";
import type { Bairro, BairroCoberturaRepo } from "./cobertura-repo";

export function criarBairroCoberturaRepoDrizzle(db: DB): BairroCoberturaRepo {
  return {
    async adicionar(nome: string): Promise<Bairro> {
      const normalizado = normalizarBairro(nome);
      // Idempotente: a constraint unique de `nome` absorve repetições; o
      // onConflictDoUpdate (no-op) garante o RETURNING mesmo quando já existe.
      const [row] = await db
        .insert(bairroCobertura)
        .values({ nome: normalizado })
        .onConflictDoUpdate({
          target: bairroCobertura.nome,
          set: { nome: normalizado },
        })
        .returning();
      return row;
    },

    async listar(): Promise<Bairro[]> {
      return db
        .select()
        .from(bairroCobertura)
        .orderBy(asc(bairroCobertura.nome));
    },

    async remover(id: string): Promise<void> {
      await db.delete(bairroCobertura).where(eq(bairroCobertura.id, id));
    },
  };
}
