import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("listarBairrosAtendidos (leitura pública)", () => {
  let repo: import("@/operacao/cobertura-repo").BairroCoberturaRepo;
  let listar: typeof import("@/operacao/cobertura-query").listarBairrosAtendidos;
  let criadoId: string;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    const { criarBairroCoberturaRepoDrizzle } = await import(
      "@/operacao/cobertura-repo-drizzle"
    );
    repo = criarBairroCoberturaRepoDrizzle(dbMod.db);
    listar = (await import("@/operacao/cobertura-query")).listarBairrosAtendidos;
  });

  afterEach(async () => {
    if (criadoId) {
      await repo.remover(criadoId);
      criadoId = "";
    }
  });

  it("expõe o bairro recém-adicionado na lista de nomes", async () => {
    const b = await repo.adicionar("Moema");
    criadoId = b.id;

    expect(await listar()).toContain("moema");
  });
});
