import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AssinanteRepo } from "@/financeiro/assinantes/assinante-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("criarAssinanteRepoDrizzle.listarAssinantes", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: AssinanteRepo;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let preapprovals: string[] = [];

  async function seed(
    status: "ATIVA" | "PAUSADA",
    planoNome?: string,
  ): Promise<{ planoId: string }> {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [pln] = await dbRaw
      .insert(schema.plano)
      .values({ nome: planoNome ?? `Plano ${r}`, preco: "120.00" })
      .returning();
    const preapproval = `pre-${r}`;
    await dbRaw.insert(schema.assinatura).values({
      clienteId: cli.id,
      planoId: pln.id,
      preapprovalIdMp: preapproval,
      status,
    });
    clienteIds.push(cli.id);
    planoIds.push(pln.id);
    preapprovals.push(preapproval);
    return { planoId: pln.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/financeiro/assinantes/assinante-repo-drizzle")
    ).criarAssinanteRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (preapprovals.length) {
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.preapprovalIdMp, preapprovals));
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
    preapprovals = [];
  });

  it("filtra por status", async () => {
    await seed("ATIVA");
    await seed("PAUSADA");

    const ativos = await repo.listarAssinantes({ status: "ATIVA" });
    expect(ativos.every((a) => a.status === "ATIVA")).toBe(true);
    expect(ativos.some((a) => preapprovals.length > 0)).toBe(true);
    expect(ativos.length).toBeGreaterThanOrEqual(1);
  });

  it("filtra por plano e traz nome do cliente + valor mensal", async () => {
    const { planoId } = await seed("ATIVA", "Premium");
    await seed("ATIVA", "Básico");

    const doPlano = await repo.listarAssinantes({ planoId });
    expect(doPlano).toHaveLength(1);
    expect(doPlano[0].planoNome).toBe("Premium");
    expect(doPlano[0].valorMensal).toBe("120.00");
    expect(doPlano[0].clienteNome).toMatch(/^Cli /);
  });
});
