import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { claimMarco } from "@/notificacao/marco";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Marco de Notificação genérico (claim)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const refIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    if (refIds.length) {
      await db
        .delete(schema.notificacaoMarco)
        .where(inArray(schema.notificacaoMarco.refId, refIds));
      refIds.length = 0;
    }
  });

  it("claim novo devolve true; claim repetido devolve false", async () => {
    const refId = randomUUID();
    refIds.push(refId);

    expect(await claimMarco(refId, "boas_vindas")).toBe(true);
    expect(await claimMarco(refId, "boas_vindas")).toBe(false);
  });

  it("mesmo refId com eventos distintos: cada evento tem claim próprio", async () => {
    const refId = randomUUID();
    refIds.push(refId);

    expect(await claimMarco(refId, "lembrete_pagamento:dia1")).toBe(true);
    expect(await claimMarco(refId, "lembrete_pagamento:dia3")).toBe(true);
    expect(await claimMarco(refId, "lembrete_pagamento:dia1")).toBe(false);
  });

  it("referência sem FK: aceita id que não é OS (ex.: assinatura)", async () => {
    // refId aleatório não existe em ordem_servico — antes da generalização a
    // FK rejeitaria o insert. Eventos de assinatura dependem disso.
    const refId = randomUUID();
    refIds.push(refId);

    expect(await claimMarco(refId, "boas_vindas")).toBe(true);
  });

  it("dois claims concorrentes para o mesmo (refId, evento) → exatamente um vence", async () => {
    const refId = randomUUID();
    refIds.push(refId);

    const resultados = await Promise.all([
      claimMarco(refId, "pedido_avaliacao:disparo"),
      claimMarco(refId, "pedido_avaliacao:disparo"),
    ]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
  });
});
