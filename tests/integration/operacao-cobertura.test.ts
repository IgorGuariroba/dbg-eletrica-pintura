import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("BairroCoberturaRepo Drizzle", () => {
  let repo: import("@/operacao/cobertura-repo").BairroCoberturaRepo;
  const criados: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    const { criarBairroCoberturaRepoDrizzle } = await import(
      "@/operacao/cobertura-repo-drizzle"
    );
    repo = criarBairroCoberturaRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
    while (criados.length) {
      const id = criados.pop();
      if (id) await repo.remover(id);
    }
  });

  it("adiciona um bairro normalizado e o lista", async () => {
    const b = await repo.adicionar(" Vila Mariana ");
    criados.push(b.id);

    expect(b.nome).toBe("vila mariana");
    const lista = await repo.listar();
    expect(lista.map((x) => x.nome)).toContain("vila mariana");
  });

  it("é idempotente: adicionar o mesmo bairro não duplica", async () => {
    const a = await repo.adicionar("Centro");
    criados.push(a.id);
    const b = await repo.adicionar("  centro ");

    expect(b.id).toBe(a.id);
    const repetidos = (await repo.listar()).filter((x) => x.nome === "centro");
    expect(repetidos).toHaveLength(1);
  });

  it("remove um bairro da lista", async () => {
    const b = await repo.adicionar("Pinheiros");
    await repo.remover(b.id);

    const lista = await repo.listar();
    expect(lista.map((x) => x.nome)).not.toContain("pinheiros");
  });
});
