import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const SECRET = process.env.MP_WEBHOOK_SECRET ?? "test_webhook_secret_dev";

// Gateway de assinatura mockado: o webhook consulta o pre-approval por id.
const buscarAssinatura = vi.fn();
vi.mock("@/assinatura/mercadopago-assinatura", () => ({
  criarGatewayMercadoPagoAssinatura: () => ({
    criarAssinatura: vi.fn(),
    pausarAssinatura: vi.fn(),
    cancelarAssinatura: vi.fn(),
    atualizarAssinatura: vi.fn(),
    buscarAssinatura,
  }),
}));

function assinar(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

function req(opts: {
  notificationId: string;
  preapprovalId: string;
  xSignature: string;
  requestId: string;
}): Request {
  return new Request("https://dbg.test/api/webhooks/mp-subscriptions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": opts.xSignature,
      "x-request-id": opts.requestId,
    },
    body: JSON.stringify({
      id: opts.notificationId,
      type: "subscription_preapproval",
      data: { id: opts.preapprovalId },
    }),
  });
}

describe.skipIf(!hasDb)("POST /api/webhooks/mp-subscriptions", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let POST: typeof import("@/app/api/webhooks/mp-subscriptions/route").POST;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let preapprovalIds: string[] = [];

  async function seedAssinatura() {
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
    });
    clienteIds.push(cli.id);
    planoIds.push(pln.id);
    preapprovalIds.push(preapproval);
    return preapproval;
  }

  async function statusDe(preapproval: string): Promise<string> {
    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select({ status: schema.assinatura.status })
      .from(schema.assinatura)
      .where(eq(schema.assinatura.preapprovalIdMp, preapproval))
      .limit(1);
    return row.status;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    POST = (await import("@/app/api/webhooks/mp-subscriptions/route")).POST;
  });

  beforeEach(() => {
    clienteIds = [];
    planoIds = [];
    preapprovalIds = [];
    buscarAssinatura.mockReset();
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (preapprovalIds.length) {
      await dbRaw
        .delete(schema.assinaturaEvento)
        .where(inArray(schema.assinaturaEvento.preapprovalIdMp, preapprovalIds));
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

  it("assinatura inválida retorna 401", async () => {
    const res = await POST(
      req({
        notificationId: "notif-1",
        preapprovalId: "pre-x",
        requestId: "req-1",
        xSignature: "ts=1700000000,v1=deadbeef",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("evento authorized retorna 200 e marca a assinatura ATIVA", async () => {
    const preapproval = await seedAssinatura();
    buscarAssinatura.mockResolvedValue({ id: preapproval, status: "authorized" });

    const ts = "1700000000";
    const res = await POST(
      req({
        notificationId: "notif-2",
        preapprovalId: preapproval,
        requestId: "req-2",
        xSignature: assinar(preapproval, "req-2", ts),
      }),
    );

    expect(res.status).toBe(200);
    expect(await statusDe(preapproval)).toBe("ATIVA");
  });

  it("notificação duplicada (mesmo id) aplica efeito uma única vez", async () => {
    const preapproval = await seedAssinatura();
    buscarAssinatura.mockResolvedValue({ id: preapproval, status: "authorized" });

    const ts = "1700000000";
    const build = () =>
      req({
        notificationId: "notif-3",
        preapprovalId: preapproval,
        requestId: "req-3",
        xSignature: assinar(preapproval, "req-3", ts),
      });

    const r1 = (await (await POST(build())).json()) as { aplicado: boolean };
    const r2 = (await (await POST(build())).json()) as { aplicado: boolean };

    expect(r1.aplicado).toBe(true);
    expect(r2.aplicado).toBe(false);
    expect(await statusDe(preapproval)).toBe("ATIVA");

    const { eq } = await import("drizzle-orm");
    const eventos = await dbRaw
      .select({ eventId: schema.assinaturaEvento.eventId })
      .from(schema.assinaturaEvento)
      .where(eq(schema.assinaturaEvento.eventId, "notif-3"));
    expect(eventos).toHaveLength(1);
  });
});
