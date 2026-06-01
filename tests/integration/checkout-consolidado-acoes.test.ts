import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { inArray } from "drizzle-orm";

// Import actions we will create
import { pagarOsAction, pagarTudoAction } from "@/app/s/[token]/pagar/actions";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Mock the gateway
const mockCriarPreferencia = vi.fn();
vi.mock("@/pagamento/mercadopago-client", () => ({
  criarGatewayMercadoPago: () => ({
    criarPreferencia: mockCriarPreferencia,
    criarPagamentoPix: vi.fn(),
    buscarPagamento: vi.fn(),
  }),
}));

describe.skipIf(!hasDb)("Checkout Consolidado Actions Integration", () => {
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];

  beforeEach(() => {
    solicitacaoIds = [];
    clienteIds = [];
    vi.clearAllMocks();

    // Default mock response for criarPreferencia
    mockCriarPreferencia.mockResolvedValue({
      id: "pref-mock-123",
      init_point: "https://mercadopago.mock/pref-mock-123",
    });
  });

  afterAll(async () => {
    if (solicitacaoIds.length) {
      const osRows = await db
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await db.delete(schema.pagamento).where(inArray(schema.pagamento.osId, osIds));
        await db.delete(schema.orcamentoItem).where(
          inArray(
            schema.orcamentoItem.orcamentoId,
            db
              .select({ id: schema.orcamento.id })
              .from(schema.orcamento)
              .where(inArray(schema.orcamento.osId, osIds))
          )
        );
        await db.delete(schema.orcamento).where(inArray(schema.orcamento.osId, osIds));
        await db.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      }
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await db
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
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
        categorias: ["ELETRICA", "PINTURA"],
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
    return { solId: sol.id };
  }

  async function seedOs(solId: string, categoria: "ELETRICA" | "PINTURA", estado: string, totalOrcamento?: string) {
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: solId,
        categoria,
        tipo: "NORMAL",
        // biome-ignore lint/suspicious/noExplicitAny: estado de teste
        estado: estado as any,
      })
      .returning();

    if (totalOrcamento) {
      await db.insert(schema.orcamento).values({
        osId: os.id,
        tokenAprovacao: `aprov-${os.id}`,
        total: totalOrcamento,
        validoAte: new Date(Date.now() + 86400 * 1000),
        aprovadoEm: new Date(),
      });
    }

    return os.id;
  }

  it("comportamento 6: individual monta preferencia certa", async () => {
    const token = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId } = await seedSetup(token);
    const osId = await seedOs(solId, "ELETRICA", "CONCLUIDA", "250.00");

    const res = await pagarOsAction(token, osId);

    expect(res).toEqual({ url: "https://mercadopago.mock/pref-mock-123" });
    expect(mockCriarPreferencia).toHaveBeenCalledTimes(1);

    const callArgs = mockCriarPreferencia.mock.calls[0][0];
    expect(callArgs.items).toEqual([
      {
        id: "item-1",
        title: "Elétrica (Serviço DBG)",
        quantity: 1,
        unit_price: 250,
        currency_id: "BRL",
      },
    ]);
    expect(callArgs.metadata).toEqual({ os_id: osId });
  });

  it("comportamento 7: seguranca - OS de outra solicitacao rejeitada", async () => {
    const token1 = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId: solId1 } = await seedSetup(token1);

    const token2 = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId: solId2 } = await seedSetup(token2);
    const osIdDeOutraSolicitacao = await seedOs(solId2, "ELETRICA", "CONCLUIDA", "300.00");

    const res = await pagarOsAction(token1, osIdDeOutraSolicitacao);

    expect(res).toEqual({ erro: "Ordem de serviço não encontrada ou não pertence a esta solicitação" });
    expect(mockCriarPreferencia).not.toHaveBeenCalled();
  });

  it("comportamento 8: 'Pagar tudo' consolida multiplas OSs", async () => {
    const token = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId } = await seedSetup(token);
    const osId1 = await seedOs(solId, "ELETRICA", "CONCLUIDA", "250.00");
    const osId2 = await seedOs(solId, "PINTURA", "CONCLUIDA", "199.90");

    const res = await pagarTudoAction(token);

    expect(res).toEqual({ url: "https://mercadopago.mock/pref-mock-123" });
    expect(mockCriarPreferencia).toHaveBeenCalledTimes(1);

    const callArgs = mockCriarPreferencia.mock.calls[0][0];
    expect(callArgs.items).toEqual([
      {
        id: "item-1",
        title: "Checkout Consolidado - DBG Elétrica e Pintura",
        quantity: 1,
        unit_price: 449.9,
        currency_id: "BRL",
      },
    ]);
    expect(callArgs.metadata).toEqual({ os_ids: [osId1, osId2] });
  });

  it("comportamento 13: ja PAGA nao recobra", async () => {
    const token = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId } = await seedSetup(token);
    const osId = await seedOs(solId, "ELETRICA", "PAGA", "250.00");

    const res = await pagarOsAction(token, osId);

    expect(res).toEqual({ erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" });
    expect(mockCriarPreferencia).not.toHaveBeenCalled();
  });
});
