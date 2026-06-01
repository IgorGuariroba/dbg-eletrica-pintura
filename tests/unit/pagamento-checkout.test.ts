import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarCobrancaPix,
  criarPreferenciaCheckoutPro,
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
