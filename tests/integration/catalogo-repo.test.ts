import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ServicoRepo Drizzle", () => {
  let repo: import("@/catalogo/servico-repo").ServicoRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let inIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarServicoRepoDrizzle } = await import(
      "@/catalogo/servico-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarServicoRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    inIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (inIds.length) {
      await dbRaw.delete(schema.servico).where(inArray(schema.servico.id, inIds));
    }
  });

  async function novo(over: Partial<Parameters<typeof repo.inserir>[0]> = {}) {
    const s = await repo.inserir({
      nome: `Teste ${Math.random().toString(36).slice(2)}`,
      categoria: "ELETRICA",
      precoBase: "150.00",
      unidade: "PONTO",
      prazoGarantiaMeses: 12,
      fotoUrl: null,
      ativo: true,
      ...over,
    });
    inIds.push(s.id);
    return s;
  }

  it("inserir persiste todos os campos e gera id + criadoEm", async () => {
    const s = await novo({
      nome: "Instalação tomada",
      precoBase: "125.50",
      fotoUrl: "https://r2.dbg/x.jpg",
    });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.nome).toBe("Instalação tomada");
    expect(s.precoBase).toBe("125.50");
    expect(s.fotoUrl).toBe("https://r2.dbg/x.jpg");
    expect(s.prazoGarantiaMeses).toBe(12);
    expect(s.ativo).toBe(true);
    expect(s.criadoEm).toBeInstanceOf(Date);

    const lido = await repo.buscarPorId(s.id);
    expect(lido).toMatchObject({
      id: s.id,
      nome: "Instalação tomada",
      categoria: "ELETRICA",
      precoBase: "125.50",
      unidade: "PONTO",
      fotoUrl: "https://r2.dbg/x.jpg",
    });
  });
});
