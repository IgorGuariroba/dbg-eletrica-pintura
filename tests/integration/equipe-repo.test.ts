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

  it("gera slug único ao inserir e resolve colisões incrementais", async () => {
    const rand = Math.random().toString(36).slice(2, 6);
    const baseNome = `Carlos Souza ${rand}`;
    const slugBase = `carlos-souza-${rand}`;

    const m1 = await novo({ nome: baseNome });
    const m2 = await novo({ nome: baseNome });

    expect(m1.slug).toBe(slugBase);
    expect(m2.slug).toBe(`${slugBase}-1`);

    const lido1 = await repo.buscarPorSlug(slugBase);
    expect(lido1?.id).toBe(m1.id);

    const lido2 = await repo.buscarPorSlug(`${slugBase}-1`);
    expect(lido2?.id).toBe(m2.id);
  });

  it("atualiza o slug quando o nome muda, resolvendo colisões sem se auto-bloquear", async () => {
    const rand = Math.random().toString(36).slice(2, 6);
    const baseNeto = `Carlos Neto ${rand}`;
    const slugNeto = `carlos-neto-${rand}`;
    const baseFilho = `Carlos Filho ${rand}`;
    const slugFilho = `carlos-filho-${rand}`;

    const m1 = await novo({ nome: baseNeto });
    expect(m1.slug).toBe(slugNeto);

    // Renomeia m1 para "Carlos Filho" -> gera novo slug
    const m1Atualizado = await repo.atualizar(m1.id, { nome: baseFilho });
    expect(m1Atualizado?.slug).toBe(slugFilho);

    // Cria m2 como "Carlos Filho" -> deve colidir e gerar carlos-filho-1
    const m2 = await novo({ nome: baseFilho });
    expect(m2.slug).toBe(`${slugFilho}-1`);

    // Atualiza m2 mudando apenas a bio -> não deve alterar o slug nem colidir consigo mesmo
    const m2Atualizado = await repo.atualizar(m2.id, { bio: "Nova bio" });
    expect(m2Atualizado?.slug).toBe(`${slugFilho}-1`);

    // Atualiza m2 mudando o nome para o mesmo valor -> não deve colidir consigo mesmo e deve manter carlos-filho-1
    const m2RenomeadoMesmo = await repo.atualizar(m2.id, { nome: baseFilho });
    expect(m2RenomeadoMesmo?.slug).toBe(`${slugFilho}-1`);
  });
});
