import { config as loadEnv } from "dotenv";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import { pagarTudoComAssinaturaAction } from "@/app/s/[token]/pagar/actions";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

const mockCriarPreferencia = vi.fn();
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  criarGatewayMercadoPago: () => ({
    criarPreferencia: mockCriarPreferencia,
    criarPagamentoPix: vi.fn(),
    buscarPagamento: vi.fn(),
  }),
}));

describe.skipIf(!hasDb)("pagarTudoComAssinaturaAction (combo upsell #65)", () => {
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  let planoIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCriarPreferencia.mockResolvedValue({
      id: "pref-combo-123",
      init_point: "https://mercadopago.mock/pref-combo-123",
    });
  });

  afterAll(async () => {
    if (clienteIds.length) {
      await db
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.clienteId, clienteIds));
    }
    if (solicitacaoIds.length) {
      const osRows = await db
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await db
          .delete(schema.orcamento)
          .where(inArray(schema.orcamento.osId, osIds));
        await db
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
      }
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await db
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (planoIds.length) {
      await db.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
    if (clienteIds.length) {
      await db
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seedSetup(token: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua Y", cidade: "Niterói", uf: "RJ" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { solId: sol.id, clienteId: cli.id };
  }

  async function seedOs(solId: string, total: string) {
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: solId,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "CONCLUIDA",
      })
      .returning();
    await db.insert(schema.orcamento).values({
      osId: os.id,
      tokenAprovacao: `aprov-${os.id}`,
      total,
      validoAte: new Date(Date.now() + 86400 * 1000),
      aprovadoEm: new Date(),
    });
    return os.id;
  }

  async function seedPlano(slug: string) {
    const [pln] = await db
      .insert(schema.plano)
      .values({
        nome: "Conforto",
        slug,
        preco: "179.00",
        percentualDesconto: "10",
        ativo: true,
      })
      .returning();
    planoIds.push(pln.id);
    return pln.id;
  }

  it("cria assinatura PENDENTE e preferência com 2 itens + metadata combinado", async () => {
    const r = Math.random().toString(36).slice(2, 10);
    const token = `tok-${r}`;
    const { solId, clienteId } = await seedSetup(token);
    const osId = await seedOs(solId, "250.00");
    const planoId = await seedPlano(`conforto-${r}`);

    const res = await pagarTudoComAssinaturaAction(token, `conforto-${r}`);

    expect(res).toEqual({ url: "https://mercadopago.mock/pref-combo-123" });
    expect(mockCriarPreferencia).toHaveBeenCalledTimes(1);

    const [ass] = await db
      .select()
      .from(schema.assinatura)
      .where(eq(schema.assinatura.clienteId, clienteId));
    expect(ass).toBeDefined();
    expect(ass.status).toBe("PENDENTE");
    expect(ass.planoId).toBe(planoId);
    expect(ass.preapprovalIdMp).toBeNull();

    const callArgs = mockCriarPreferencia.mock.calls[0][0];
    expect(callArgs.items).toEqual([
      {
        id: "item-1",
        title: "Checkout Consolidado - DBG Elétrica e Pintura",
        quantity: 1,
        unit_price: 250,
        currency_id: "BRL",
      },
      {
        id: "item-2",
        title: "1ª mensalidade — Plano Conforto",
        quantity: 1,
        unit_price: 179,
        currency_id: "BRL",
      },
    ]);
    expect(callArgs.metadata).toEqual({
      os_ids: [osId],
      assinatura_id: ass.id,
      cliente_id: clienteId,
    });
  });

  it("assinante ativo é recusado e nada vai ao MP", async () => {
    const r = Math.random().toString(36).slice(2, 10);
    const token = `tok-${r}`;
    const { solId, clienteId } = await seedSetup(token);
    await seedOs(solId, "250.00");
    const planoId = await seedPlano(`conforto-${r}`);

    await db.insert(schema.assinatura).values({
      clienteId,
      planoId,
      status: "ATIVA",
    });

    const res = await pagarTudoComAssinaturaAction(token, `conforto-${r}`);

    expect(res).toEqual({ erro: "Você já é assinante de um plano DBG" });
    expect(mockCriarPreferencia).not.toHaveBeenCalled();

    const assinaturas = await db
      .select()
      .from(schema.assinatura)
      .where(eq(schema.assinatura.clienteId, clienteId));
    expect(assinaturas).toHaveLength(1); // só a seedada, nenhuma PENDENTE nova
  });
});
