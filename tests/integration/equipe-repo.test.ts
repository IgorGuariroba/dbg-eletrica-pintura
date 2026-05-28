import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("MembroRepo Drizzle", () => {
  let repo: import("@/equipe/membro-repo").MembroRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let inIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarMembroRepoDrizzle } = await import(
      "@/equipe/membro-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarMembroRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    inIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (inIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, inIds));
    }
  });

  async function novo(
    over: Partial<Parameters<typeof repo.inserir>[0]> = {},
  ) {
    const rand = Math.random().toString(36).slice(2);
    const m = await repo.inserir({
      nome: `Teste ${rand}`,
      email: `teste-${rand}@dbg.com.br`,
      modulos: ["FINANCEIRO"],
      isTecnico: false,
      fotoUrl: null,
      bio: null,
      especialidades: [],
      disponibilidade: null,
      ativo: true,
      ...over,
    });
    inIds.push(m.id);
    return m;
  }

  it("persiste todos os campos incluindo disponibilidade", async () => {
    const m = await novo({
      nome: "Diego",
      modulos: ["OPERACAO", "EQUIPE"],
      isTecnico: true,
      bio: "Eletricista 20 anos de experiência",
      especialidades: ["ELETRICA"],
      disponibilidade: {
        seg: { inicio: "08:00", fim: "18:00" },
        ter: { inicio: "08:00", fim: "18:00" },
      },
    });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    const lido = await repo.buscarPorId(m.id);
    expect(lido).toMatchObject({
      nome: "Diego",
      modulos: ["OPERACAO", "EQUIPE"],
      isTecnico: true,
      especialidades: ["ELETRICA"],
      disponibilidade: {
        seg: { inicio: "08:00", fim: "18:00" },
        ter: { inicio: "08:00", fim: "18:00" },
      },
    });
  });

  it("buscarPorEmail é case-insensitive", async () => {
    const rand = Math.random().toString(36).slice(2);
    const email = `Mixed-${rand}@DBG.com.BR`;
    const m = await novo({ email: email.toLowerCase() });
    const lido = await repo.buscarPorEmail(email);
    expect(lido?.id).toBe(m.id);
  });

  it("toggleAtivo inverte atomicamente", async () => {
    const m = await novo({ ativo: true });
    const a = await repo.toggleAtivo(m.id);
    expect(a?.ativo).toBe(false);
    const b = await repo.toggleAtivo(m.id);
    expect(b?.ativo).toBe(true);
  });
});
