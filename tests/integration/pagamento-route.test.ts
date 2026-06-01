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

// Gateway do Mercado Pago mockado: o webhook consulta o pagamento por id.
const buscarPagamento = vi.fn();
vi.mock("@/pagamento/mercadopago-client", () => ({
  criarGatewayMercadoPago: () => ({
    criarPreferencia: vi.fn(),
    criarPagamentoPix: vi.fn(),
    buscarPagamento,
  }),
}));

function assinar(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

function req(opts: {
  dataId: string;
  xSignature: string;
  requestId: string;
}): Request {
  return new Request("https://dbg.test/api/webhooks/mercadopago", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": opts.xSignature,
      "x-request-id": opts.requestId,
    },
    body: JSON.stringify({ type: "payment", data: { id: opts.dataId } }),
  });
}

describe.skipIf(!hasDb)("POST /api/webhooks/mercadopago", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let POST: typeof import("@/app/api/webhooks/mercadopago/route").POST;
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  let paymentIds: string[] = [];

  async function seedConcluida() {
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
        estado: "CONCLUIDA",
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
    POST = (await import("@/app/api/webhooks/mercadopago/route")).POST;
  });

  beforeEach(() => {
    solicitacaoIds = [];
    clienteIds = [];
    paymentIds = [];
    buscarPagamento.mockReset();
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
          .delete(schema.pagamento)
          .where(inArray(schema.pagamento.osId, osIds));
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
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

  it("assinatura inválida retorna 401", async () => {
    const res = await POST(
      req({
        dataId: "123456",
        requestId: "req-1",
        xSignature: "ts=1700000000,v1=deadbeef",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("assinatura válida + pagamento aprovado retorna 200 e transita a OS", async () => {
    const osId = await seedConcluida();
    const paymentId = `pay-${Math.random().toString(36).slice(2, 10)}`;
    paymentIds.push(paymentId);

    buscarPagamento.mockResolvedValue({
      id: paymentId,
      status: "approved",
      transaction_amount: 212,
      payment_method_id: "pix",
      metadata: { os_id: osId },
    });

    const ts = "1700000000";
    const res = await POST(
      req({
        dataId: paymentId,
        requestId: "req-2",
        xSignature: assinar(paymentId, "req-2", ts),
      }),
    );

    expect(res.status).toBe(200);
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("PAGA");
  });
});
