import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("listarAssinaturasCliente (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let listar: typeof import("@/assinatura/listar-assinaturas-cliente").listarAssinaturasCliente;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    listar = (await import("@/assinatura/listar-assinaturas-cliente"))
      .listarAssinaturasCliente;
  });

  beforeEach(() => {
    clienteIds = [];
    planoIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.clienteId, clienteIds));
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
    if (planoIds.length) {
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
  });

  it("lista assinaturas do cliente pelo whatsapp, com nome do plano e status", async () => {
    const r = Math.random().toString(36).slice(2, 10);
    const whatsapp = String(Math.floor(1e12 + Math.random() * 9e12));
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp })
      .returning();
    const [pln] = await dbRaw
      .insert(schema.plano)
      .values({ nome: `Plano ${r}`, slug: `plano-${r}`, preco: "149.90" })
      .returning();
    await dbRaw.insert(schema.assinatura).values({
      clienteId: cli.id,
      planoId: pln.id,
      preapprovalIdMp: `pre-${r}`,
      status: "ATIVA",
    });
    clienteIds.push(cli.id);
    planoIds.push(pln.id);

    const lista = await listar(whatsapp, dbRaw);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      planoNome: `Plano ${r}`,
      status: "ATIVA",
      preco: "149.90",
    });
  });

  it("não retorna assinaturas de outro cliente", async () => {
    const lista = await listar("000000000000", dbRaw);
    expect(lista).toEqual([]);
  });
});
