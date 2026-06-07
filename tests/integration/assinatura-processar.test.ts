import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { EventoAssinatura } from "@/assinatura/processar-evento";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("processarEventoAssinatura (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let processarEventoAssinatura: typeof import("@/assinatura/processar-evento").processarEventoAssinatura;
  let deps: import("@/assinatura/processar-evento").ProcessarEventoDeps;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let preapprovalIds: string[] = [];
  let eventIds: string[] = [];

  async function seedAssinatura(status = "PENDENTE") {
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
      .values({ nome: `Plano ${r}`, preco: "99.90" })
      .returning();
    const preapproval = `pre-${r}`;
    await dbRaw.insert(schema.assinatura).values({
      clienteId: cli.id,
      planoId: pln.id,
      preapprovalIdMp: preapproval,
      // biome-ignore lint/suspicious/noExplicitAny: estado de teste
      status: status as any,
    });
    clienteIds.push(cli.id);
    planoIds.push(pln.id);
    preapprovalIds.push(preapproval);
    return { preapproval };
  }

  function evento(
    preapproval: string,
    tipo: EventoAssinatura["tipo"] = "authorized",
    eventId?: string,
  ): EventoAssinatura {
    const id = eventId ?? `evt-${Math.random().toString(36).slice(2, 10)}`;
    eventIds.push(id);
    return { eventId: id, preapprovalIdMp: preapproval, tipo };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    processarEventoAssinatura = (
      await import("@/assinatura/processar-evento")
    ).processarEventoAssinatura;
    deps = {
      repo: (
        await import("@/assinatura/assinatura-repo-drizzle")
      ).criarAssinaturaRepoDrizzle(dbMod.db),
    };
  });

  beforeEach(() => {
    clienteIds = [];
    planoIds = [];
    preapprovalIds = [];
    eventIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (eventIds.length) {
      await dbRaw
        .delete(schema.assinaturaEvento)
        .where(inArray(schema.assinaturaEvento.eventId, eventIds));
    }
    if (preapprovalIds.length) {
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.preapprovalIdMp, preapprovalIds));
    }
    if (planoIds.length) {
      await dbRaw
        .delete(schema.plano)
        .where(inArray(schema.plano.id, planoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function statusDe(preapproval: string): Promise<string> {
    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select({ status: schema.assinatura.status })
      .from(schema.assinatura)
      .where(eq(schema.assinatura.preapprovalIdMp, preapproval))
      .limit(1);
    return row.status;
  }

  async function linhasEvento(eventId: string): Promise<number> {
    const { eq } = await import("drizzle-orm");
    const rows = await dbRaw
      .select({ eventId: schema.assinaturaEvento.eventId })
      .from(schema.assinaturaEvento)
      .where(eq(schema.assinaturaEvento.eventId, eventId));
    return rows.length;
  }

  it("evento authorized atualiza o status da assinatura para ATIVA", async () => {
    const { preapproval } = await seedAssinatura();
    const e = evento(preapproval, "authorized");

    const out = await processarEventoAssinatura(e, deps);

    expect(out.aplicado).toBe(true);
    expect(await statusDe(preapproval)).toBe("ATIVA");
    expect(await linhasEvento(e.eventId)).toBe(1);
  });

  it("mesmo event_id 2x persiste 1 linha e não reaplica efeito", async () => {
    const { preapproval } = await seedAssinatura();
    const e = evento(preapproval, "authorized");

    const primeira = await processarEventoAssinatura(e, deps);
    // 2ª com tipo diferente: se reaplicasse, viraria CANCELADA.
    const segunda = await processarEventoAssinatura(
      { ...e, tipo: "cancelled" },
      deps,
    );

    expect(primeira.aplicado).toBe(true);
    expect(segunda.aplicado).toBe(false);
    expect(await statusDe(preapproval)).toBe("ATIVA");
    expect(await linhasEvento(e.eventId)).toBe(1);
  });

  it("payment_failed persiste INADIMPLENTE", async () => {
    const { preapproval } = await seedAssinatura("ATIVA");
    const e = evento(preapproval, "payment_failed");

    await processarEventoAssinatura(e, deps);

    expect(await statusDe(preapproval)).toBe("INADIMPLENTE");
  });

  it("payment_recovered reverte INADIMPLENTE para ATIVA", async () => {
    const { preapproval } = await seedAssinatura("INADIMPLENTE");
    const e = evento(preapproval, "payment_recovered");

    await processarEventoAssinatura(e, deps);

    expect(await statusDe(preapproval)).toBe("ATIVA");
  });
});
