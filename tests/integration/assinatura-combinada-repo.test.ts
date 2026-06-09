import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AssinaturaCombinadaRepo } from "@/assinatura/assinatura-combinada";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("criarAssinaturaCombinadaRepoDrizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: AssinaturaCombinadaRepo;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];

  async function seedClientePlano() {
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
      .values({ nome: `Plano ${r}`, preco: "179.00" })
      .returning();
    clienteIds.push(cli.id);
    planoIds.push(pln.id);
    return { clienteId: cli.id, planoId: pln.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/assinatura/assinatura-combinada-repo-drizzle")
    ).criarAssinaturaCombinadaRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
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
    clienteIds = [];
    planoIds = [];
  });

  it("criarPendente + ativarSePendente: ativa 1ª vez, duplicado é nao_pendente", async () => {
    const { clienteId, planoId } = await seedClientePlano();
    const { id } = await repo.criarPendente({ clienteId, planoId });

    const inicio = new Date("2026-06-09T12:00:00Z");
    const fim = new Date("2026-07-09T12:00:00Z");

    expect(
      await repo.ativarSePendente(id, { inicio, fimCicloAtual: fim }),
    ).toBe("ativada");

    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.assinatura)
      .where(eq(schema.assinatura.id, id));
    expect(row.status).toBe("ATIVA");
    expect(row.inicio?.getTime()).toBe(inicio.getTime());
    expect(row.fimCicloAtual?.getTime()).toBe(fim.getTime());
    expect(row.preapprovalIdMp).toBeNull();

    expect(
      await repo.ativarSePendente(id, { inicio, fimCicloAtual: fim }),
    ).toBe("nao_pendente");
  });

  it("assinatura inexistente devolve nao_encontrada", async () => {
    expect(
      await repo.ativarSePendente("00000000-0000-0000-0000-000000000000", {
        inicio: new Date(),
        fimCicloAtual: new Date(),
      }),
    ).toBe("nao_encontrada");
  });
});
