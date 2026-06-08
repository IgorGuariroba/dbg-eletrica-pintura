import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ChecklistItemRepo Drizzle", () => {
  let repo: import("@/catalogo/checklist-repo").ChecklistItemRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let inIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarChecklistItemRepoDrizzle } = await import(
      "@/catalogo/checklist-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarChecklistItemRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    inIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (inIds.length) {
      await dbRaw
        .delete(schema.checklistPreventivoItem)
        .where(inArray(schema.checklistPreventivoItem.id, inIds));
    }
  });

  async function novo(
    over: Partial<Parameters<typeof repo.inserir>[0]> = {},
  ) {
    const i = await repo.inserir({
      categoria: "ELETRICA",
      ordem: 0,
      descricao: `Item ${Math.random().toString(36).slice(2)}`,
      exigeFoto: false,
      ...over,
    });
    inIds.push(i.id);
    return i;
  }

  it("inserir persiste campos e gera id + criadoEm + ativo default", async () => {
    const i = await novo({ descricao: "Verificar disjuntores", exigeFoto: true });
    expect(i.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(i.descricao).toBe("Verificar disjuntores");
    expect(i.exigeFoto).toBe(true);
    expect(i.ativo).toBe(true);
    expect(i.criadoEm).toBeInstanceOf(Date);

    const lido = await repo.buscarPorId(i.id);
    expect(lido).toMatchObject({
      id: i.id,
      categoria: "ELETRICA",
      descricao: "Verificar disjuntores",
      exigeFoto: true,
    });
  });

  it("listarPorCategoria retorna itens ordenados por ordem", async () => {
    await novo({ categoria: "PINTURA", ordem: 2, descricao: "C" });
    await novo({ categoria: "PINTURA", ordem: 0, descricao: "A" });
    await novo({ categoria: "PINTURA", ordem: 1, descricao: "B" });

    const itens = await repo.listarPorCategoria("PINTURA");
    const nossos = itens.filter((i) => inIds.includes(i.id));
    expect(nossos.map((i) => i.descricao)).toEqual(["A", "B", "C"]);
  });

  it("atualizar altera descrição/exigeFoto e remover apaga", async () => {
    const i = await novo({ descricao: "Original" });
    const atualizado = await repo.atualizar(i.id, {
      descricao: "Editado",
      exigeFoto: true,
    });
    expect(atualizado).toMatchObject({ descricao: "Editado", exigeFoto: true });

    const removido = await repo.remover(i.id);
    expect(removido).toBe(true);
    expect(await repo.buscarPorId(i.id)).toBeNull();
  });
});
