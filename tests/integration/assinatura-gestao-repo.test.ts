import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("AssinaturaRepo — gestão de pendências (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/assinatura/assinatura-repo").AssinaturaRepo;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let preapprovalIds: string[] = [];

  async function seed(precoBasico = "49.90", precoPremium = "99.90") {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [basico] = await dbRaw
      .insert(schema.plano)
      .values({ nome: `Básico ${r}`, preco: precoBasico })
      .returning();
    const [premium] = await dbRaw
      .insert(schema.plano)
      .values({ nome: `Premium ${r}`, preco: precoPremium })
      .returning();
    const preapproval = `pre-${r}`;
    await dbRaw.insert(schema.assinatura).values({
      clienteId: cli.id,
      planoId: premium.id,
      preapprovalIdMp: preapproval,
      status: "ATIVA",
      fimCicloAtual: new Date("2026-06-28T00:00:00Z"),
    });
    clienteIds.push(cli.id);
    planoIds.push(basico.id, premium.id);
    preapprovalIds.push(preapproval);
    return { preapproval, basicoId: basico.id, premiumId: premium.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/assinatura/assinatura-repo-drizzle")
    ).criarAssinaturaRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    planoIds = [];
    preapprovalIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (preapprovalIds.length) {
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.preapprovalIdMp, preapprovalIds));
    }
    if (planoIds.length) {
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("marca cancelamento pendente sem mudar o status e depois efetiva CANCELADA", async () => {
    const { preapproval } = await seed();
    const dataEfetivacao = new Date("2026-06-28T00:00:00Z");

    await repo.marcarCancelamentoPendente?.(preapproval, {
      motivo: "cliente desistiu",
      dataEfetivacao,
    });

    const pendente = await repo.carregarPorPreapproval?.(preapproval);
    expect(pendente?.status).toBe("ATIVA");
    expect(pendente?.cancelamentoPendente).toBe(true);
    expect(pendente?.dataEfetivacao).toEqual(dataEfetivacao);

    await repo.efetivarCancelamento?.(preapproval, new Date());

    const efetivada = await repo.carregarPorPreapproval?.(preapproval);
    expect(efetivada?.status).toBe("CANCELADA");
    expect(efetivada?.cancelamentoPendente).toBe(false);
    expect(efetivada?.dataEfetivacao).toBeNull();
  });

  it("agenda downgrade e efetiva a troca de plano", async () => {
    const { preapproval, basicoId, premiumId } = await seed();

    await repo.marcarDowngradePendente?.(preapproval, {
      planoPendenteId: basicoId,
      dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
    });

    const pendente = await repo.carregarPorPreapproval?.(preapproval);
    expect(pendente?.planoId).toBe(premiumId);
    expect(pendente?.planoPendenteId).toBe(basicoId);

    await repo.efetivarDowngrade?.(preapproval, basicoId);

    const efetivada = await repo.carregarPorPreapproval?.(preapproval);
    expect(efetivada?.planoId).toBe(basicoId);
    expect(efetivada?.planoPendenteId).toBeNull();
  });
});
