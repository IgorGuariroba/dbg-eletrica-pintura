import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarCobrancaPix,
  criarPreferenciaCheckoutPro,
  montarCheckoutConsolidado,
} from "@/pagamento/checkout";
import type { GatewayPagamento } from "@/pagamento/gateway";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dbg.test");
});

function fakeGateway(): GatewayPagamento {
  return {
    criarPreferencia: vi.fn(async () => ({
      id: "pref-123",
      init_point: "https://mp.test/checkout/pref-123",
    })),
    criarPagamentoPix: vi.fn(async () => ({
      id: 987654,
      point_of_interaction: {
        transaction_data: {
          qr_code_base64: "iVBORw0KGgoQR==",
          qr_code: "00020126pix-copia-e-cola",
        },
      },
    })),
    buscarPagamento: vi.fn(),
  } as unknown as GatewayPagamento;
}

describe("criarPreferenciaCheckoutPro", () => {
  it("monta a preferência com items, metadata.os_id e back_urls e devolve url + id", async () => {
    const gateway = fakeGateway();

    const out = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        { titulo: "Instalação elétrica", quantidade: 1, precoUnitario: "250.00" },
      ],
      metadata: { os_id: "os-uuid-1" },
    });

    expect(out).toEqual({
      url: "https://mp.test/checkout/pref-123",
      preferenciaId: "pref-123",
    });

    const req = vi.mocked(gateway.criarPreferencia).mock.calls[0][0];
    expect(req.items).toEqual([
      expect.objectContaining({
        title: "Instalação elétrica",
        quantity: 1,
        unit_price: 250,
      }),
    ]);
    expect(req.metadata).toEqual({ os_id: "os-uuid-1" });
    expect(req.back_urls?.success).toBe("https://dbg.test/pagamento/sucesso");
    expect(req.back_urls?.failure).toBe("https://dbg.test/pagamento/falha");
  });
});

describe("criarCobrancaPix", () => {
  it("devolve QR base64, copia-e-cola e id da transação", async () => {
    const gateway = fakeGateway();

    const out = await criarCobrancaPix(gateway, {
      valor: "199.90",
      descricao: "OS 42 — Pintura",
      metadata: { os_id: "os-uuid-1" },
    });

    expect(out).toEqual({
      qrBase64: "iVBORw0KGgoQR==",
      copiaCola: "00020126pix-copia-e-cola",
      transacaoId: "987654",
    });

    const req = vi.mocked(gateway.criarPagamentoPix).mock.calls[0][0];
    expect(req.transaction_amount).toBe(199.9);
    expect(req.description).toBe("OS 42 — Pintura");
    expect(req.metadata).toEqual({ os_id: "os-uuid-1" });
  });
});

describe("montarCheckoutConsolidado", () => {
  it("tracer bullet: partição básica com 1 OS CONCLUIDA", () => {
    const out = montarCheckoutConsolidado([
      { osId: "os-1", categoria: "ELETRICA", estado: "CONCLUIDA", total: "250.00", pago: false },
    ]);

    expect(out.pagaveis).toEqual([
      { osId: "os-1", total: "250.00", categoria: "ELETRICA" },
    ]);
    expect(out.pagas).toEqual([]);
    expect(out.somaPagavel).toBe("250.00");
    expect(out.osIds).toEqual(["os-1"]);
    expect(out.podePagarTudo).toBe(true);
  });

  it("comportamento 2: OS PAGA não entra no pagável", () => {
    const out = montarCheckoutConsolidado([
      { osId: "os-1", categoria: "ELETRICA", estado: "CONCLUIDA", total: "250.00", pago: false },
      { osId: "os-2", categoria: "PINTURA", estado: "PAGA", total: "100.00", pago: true },
    ]);

    expect(out.pagaveis).toEqual([
      { osId: "os-1", total: "250.00", categoria: "ELETRICA" },
    ]);
    expect(out.pagas).toEqual([
      { osId: "os-2", total: "100.00", categoria: "PINTURA" },
    ]);
    expect(out.somaPagavel).toBe("250.00");
    expect(out.podePagarTudo).toBe(true);
  });

  it("comportamento 3: nada pagável", () => {
    const out = montarCheckoutConsolidado([
      { osId: "os-1", categoria: "ELETRICA", estado: "PAGA", total: "250.00", pago: true },
    ]);

    expect(out.pagaveis).toEqual([]);
    expect(out.pagas).toEqual([
      { osId: "os-1", total: "250.00", categoria: "ELETRICA" },
    ]);
    expect(out.somaPagavel).toBe("0.00");
    expect(out.osIds).toEqual([]);
    expect(out.podePagarTudo).toBe(false);
  });

  it("comportamento 4: soma de múltiplas OSs com precisão decimal", () => {
    const out = montarCheckoutConsolidado([
      { osId: "os-1", categoria: "ELETRICA", estado: "CONCLUIDA", total: "250.00", pago: false },
      { osId: "os-2", categoria: "PINTURA", estado: "CONCLUIDA", total: "199.90", pago: false },
    ]);

    expect(out.pagaveis).toEqual([
      { osId: "os-1", total: "250.00", categoria: "ELETRICA" },
      { osId: "os-2", total: "199.90", categoria: "PINTURA" },
    ]);
    expect(out.somaPagavel).toBe("449.90");
    expect(out.osIds).toEqual(["os-1", "os-2"]);
    expect(out.podePagarTudo).toBe(true);
  });
});

