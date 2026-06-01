import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { gerarPixAction, gerarLinkAction, registrarManualAction } from "@/app/campo/os/[id]/cobranca/actions";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Mock do guard de técnico para simular autenticação
const mockExigirTecnico = vi.fn();
vi.mock("@/app/campo/guard", () => ({
  exigirTecnico: () => mockExigirTecnico(),
}));

// Mock do gateway para evitar requisições reais de rede
const mockCriarPagamentoPix = vi.fn();
const mockCriarPreferencia = vi.fn();
vi.mock("@/pagamento/mercadopago-client", () => ({
  criarGatewayMercadoPago: () => ({
    criarPagamentoPix: mockCriarPagamentoPix,
    criarPreferencia: mockCriarPreferencia,
    buscarPagamento: vi.fn(),
  }),
}));

describe.skipIf(!hasDb)("Payment Actions Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];

  type TipoOs = "NORMAL" | "EXPRESS" | "COMPLEMENTAR" | "PREVENTIVA" | "GARANTIA";

  async function seedOs(estado: string, tipo: TipoOs = "NORMAL") {
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
        tipo,
        estado: estado as any,
      })
      .returning();
    
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id as string };
  }

  async function seedOrcamento(osId: string, total: string, aprovado = true) {
    const [orc] = await dbRaw
      .insert(schema.orcamento)
      .values({
        osId,
        tokenAprovacao: `tok-aprov-${Math.random().toString(36).slice(2, 10)}`,
        totalMaoDeObra: total,
        totalDeslocamento: "0.00",
        total,
        validoAte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        aprovadoEm: aprovado ? new Date() : null,
      })
      .returning();
    return orc.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    vi.clearAllMocks();
    // Técnico padrão autenticado
    mockExigirTecnico.mockResolvedValue({
      membroId: "tec-123",
      nome: "Técnico Teste",
      email: "tecnico@dbg.test",
      especialidades: ["ELETRICA"],
    });
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
        await dbRaw
          .delete(schema.orcamento)
          .where(inArray(schema.orcamento.osId, osIds));
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

  describe("gerarPixAction", () => {
    it("falha com mensagem de erro clara se o gateway lançar exceção", async () => {
      const { osId } = await seedOs("CONCLUIDA");
      await seedOrcamento(osId, "250.00");

      mockCriarPagamentoPix.mockRejectedValue(new Error("Mercado Pago está offline"));

      const res = await gerarPixAction(osId);
      expect(res.ok).toBeUndefined();
      expect(res.erro).toBe("Mercado Pago está offline");
    });

    it("retorna qrBase64 e copiaCola em caso de sucesso", async () => {
      const { osId } = await seedOs("CONCLUIDA");
      await seedOrcamento(osId, "320.00");

      mockCriarPagamentoPix.mockResolvedValue({
        id: 112233,
        point_of_interaction: {
          transaction_data: {
            qr_code_base64: "dGVzdC1xci1jb2Rl",
            qr_code: "pix-copia-cola-test",
          },
        },
      });

      const res = await gerarPixAction(osId);
      expect(res.ok).toBe(true);
      expect(res.qrBase64).toBe("dGVzdC1xci1jb2Rl");
      expect(res.copiaCola).toBe("pix-copia-cola-test");
    });
  });

  describe("gerarLinkAction", () => {
    it("retorna urlWaMe montada com a url do checkout", async () => {
      const { osId } = await seedOs("CONCLUIDA");
      await seedOrcamento(osId, "450.00");

      mockCriarPreferencia.mockResolvedValue({
        id: "pref-abc",
        init_point: "https://mercadopago.com/checkout/pref-abc",
      });

      const res = await gerarLinkAction(osId);
      expect(res.ok).toBe(true);
      expect(res.urlWaMe).toContain("https://wa.me/");
      expect(res.urlWaMe).toContain(encodeURIComponent("https://mercadopago.com/checkout/pref-abc"));
    });
  });
});
