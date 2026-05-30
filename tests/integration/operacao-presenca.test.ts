import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { confirmarPresenca } from "@/operacao/presenca";
import { criarPresencaRepoDrizzle } from "@/operacao/presenca-repo-drizzle";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("PresencaRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/presenca-repo").PresencaRepo;
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];

  async function seedOs() {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "A_CAMINHO",
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id as string;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = criarPresencaRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      const osRows = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.confirmacaoPresenca)
          .where(inArray(schema.confirmacaoPresenca.osId, osIds));
      }
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("registra a confirmação com IP e timestamp", async () => {
    const osId = await seedOs();
    const r = await confirmarPresenca(osId, "1.2.3.4", repo);
    expect(r.jaConfirmado).toBe(false);

    const reg = await repo.buscar(osId);
    expect(reg?.ip).toBe("1.2.3.4");
    expect(reg?.confirmadoEm).toBeTruthy();
  });

  it("é idempotente: clicar 2x registra 1 vez, preservando o primeiro IP", async () => {
    const osId = await seedOs();
    await confirmarPresenca(osId, "1.1.1.1", repo);
    const segunda = await confirmarPresenca(osId, "9.9.9.9", repo);

    expect(segunda.jaConfirmado).toBe(true);
    const reg = await repo.buscar(osId);
    expect(reg?.ip).toBe("1.1.1.1");
  });
});
