import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Referral Drizzle Schema & Repo (Slice 0)", () => {
  let db: typeof import("@/db/client").db;

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
  });

  afterEach(async () => {
    if (schema.configReferral) {
      await db.delete(schema.configReferral);
    }
    if (schema.indicacao) {
      await db.delete(schema.indicacao);
    }
  });

  it("garante que a tabela configReferral e indicacao e a coluna saldoCredito no cliente existem", async () => {
    // 1. Testa configReferral
    expect(schema.configReferral).toBeDefined();
    const [insertedConfig] = await db
      .insert(schema.configReferral)
      .values({
        valorPremio: "50.00",
        ativo: true,
      })
      .returning();

    expect(insertedConfig).toBeDefined();
    expect(insertedConfig.valorPremio).toBe("50.00");
    expect(insertedConfig.ativo).toBe(true);

    // 2. Cria clientes de teste
    const [indicador] = await db
      .insert(schema.cliente)
      .values({
        nome: "Indicador Teste",
        whatsapp: "11999990001",
        saldoCredito: "30.00", // testa a nova coluna
      })
      .returning();

    expect(indicador).toBeDefined();
    expect(indicador.saldoCredito).toBe("30.00");

    const [indicado] = await db
      .insert(schema.cliente)
      .values({
        nome: "Indicado Teste",
        whatsapp: "11999990002",
      })
      .returning();

    // 3. Testa indicacao
    expect(schema.indicacao).toBeDefined();
    const [insertedIndicacao] = await db
      .insert(schema.indicacao)
      .values({
        indicadorId: indicador.id,
        indicadoId: indicado.id,
        descontoAplicado: false,
        creditoGerado: false,
      })
      .returning();

    expect(insertedIndicacao).toBeDefined();
    expect(insertedIndicacao.indicadorId).toBe(indicador.id);
    expect(insertedIndicacao.indicadoId).toBe(indicado.id);

    // Cleanup dos clientes criados
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.cliente).where(inArray(schema.cliente.id, [indicador.id, indicado.id]));
  });
});
