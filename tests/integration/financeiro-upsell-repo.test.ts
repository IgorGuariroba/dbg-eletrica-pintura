import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { UpsellRepo } from "@/financeiro/upsell/upsell-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("criarUpsellRepoDrizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: UpsellRepo;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let assinaturaIds: string[] = [];

  async function seedCliente(): Promise<string> {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    clienteIds.push(cli.id);
    return cli.id;
  }

  async function seedAssinatura(
    clienteId: string,
    status: "ATIVA" | "PENDENTE" | "CANCELADA",
  ): Promise<void> {
    const r = Math.random().toString(36).slice(2, 10);
    const [pln] = await dbRaw
      .insert(schema.plano)
      .values({ nome: `Plano ${r}`, preco: "120.00" })
      .returning();
    planoIds.push(pln.id);
    const [ass] = await dbRaw
      .insert(schema.assinatura)
      .values({ clienteId, planoId: pln.id, status })
      .returning();
    assinaturaIds.push(ass.id);
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/financeiro/upsell/upsell-repo-drizzle")
    ).criarUpsellRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (assinaturaIds.length) {
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.id, assinaturaIds));
    }
    if (planoIds.length) {
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
    clienteIds = [];
    planoIds = [];
    assinaturaIds = [];
  });

  it("temAssinaturaAtiva: true só com assinatura ATIVA", async () => {
    const comAtiva = await seedCliente();
    await seedAssinatura(comAtiva, "ATIVA");

    const comPendente = await seedCliente();
    await seedAssinatura(comPendente, "PENDENTE");

    const comCancelada = await seedCliente();
    await seedAssinatura(comCancelada, "CANCELADA");

    const semNada = await seedCliente();

    expect(await repo.temAssinaturaAtiva(comAtiva)).toBe(true);
    expect(await repo.temAssinaturaAtiva(comPendente)).toBe(false);
    expect(await repo.temAssinaturaAtiva(comCancelada)).toBe(false);
    expect(await repo.temAssinaturaAtiva(semNada)).toBe(false);
  });

  it("marcarUpsellVisto persiste e upsellVistoEm lê de volta", async () => {
    const clienteId = await seedCliente();
    expect(await repo.upsellVistoEm(clienteId)).toBeNull();

    const quando = new Date("2026-06-09T12:00:00Z");
    await repo.marcarUpsellVisto(clienteId, quando);

    const lido = await repo.upsellVistoEm(clienteId);
    expect(lido?.getTime()).toBe(quando.getTime());
  });

  it("planoDestaque devolve plano ativo de maior desconto com slug", async () => {
    const r = Math.random().toString(36).slice(2, 10);
    const inserir = (over: {
      nome: string;
      slug?: string | null;
      percentualDesconto: string;
      ativo?: boolean;
    }) =>
      dbRaw
        .insert(schema.plano)
        .values({ preco: "150.00", ...over })
        .returning()
        .then(([p]) => {
          planoIds.push(p.id);
          return p;
        });

    // Descontos próximos do teto (999.99) para o teste não depender de planos
    // pré-existentes no banco compartilhado (suíte de integração não hermética).
    await inserir({
      nome: `Inativo ${r}`,
      slug: `inativo-${r}`,
      percentualDesconto: "999.99",
      ativo: false,
    });
    await inserir({
      nome: `Sem slug ${r}`,
      slug: null,
      percentualDesconto: "999.98",
    });
    const esperado = await inserir({
      nome: `Premium ${r}`,
      slug: `premium-${r}`,
      percentualDesconto: "999.90",
    });
    await inserir({
      nome: `Basico ${r}`,
      slug: `basico-${r}`,
      percentualDesconto: "5",
    });

    const destaque = await repo.planoDestaque();

    expect(destaque?.id).toBe(esperado.id);
    expect(destaque?.slug).toBe(`premium-${r}`);
    expect(Number(destaque?.percentualDesconto)).toBe(999.9);
  });

  it("contarAssinaturasAtivas cresce com nova ATIVA", async () => {
    const antes = await repo.contarAssinaturasAtivas();

    const c1 = await seedCliente();
    await seedAssinatura(c1, "ATIVA");

    // >= por causa de seeds paralelos (banco compartilhado entre workers).
    expect(await repo.contarAssinaturasAtivas()).toBeGreaterThanOrEqual(
      antes + 1,
    );
  });
});
