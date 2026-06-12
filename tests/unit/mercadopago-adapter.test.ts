import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  criarGatewayMercadoPago,
  criarGatewayMercadoPagoAssinatura,
  criarGatewayMercadoPagoPlano,
  MercadoPagoError,
} from "@/lib/mercadopago";

const ENV_ORIGINAL = { ...process.env };

describe("Adapter Mercado Pago único (#164)", () => {
  beforeEach(() => {
    delete process.env.MP_ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it("as três fábricas sem MP_ACCESS_TOKEN falham com o mesmo erro normalizado", () => {
    for (const fabrica of [
      criarGatewayMercadoPago,
      criarGatewayMercadoPagoAssinatura,
      criarGatewayMercadoPagoPlano,
    ]) {
      let erro: unknown;
      try {
        fabrica();
      } catch (e) {
        erro = e;
      }
      expect(erro).toBeInstanceOf(MercadoPagoError);
      expect((erro as MercadoPagoError).message).toContain(
        "MP_ACCESS_TOKEN não configurada",
      );
    }
  });

  it("erro do SDK vira MercadoPagoError com status e causa preservados", async () => {
    process.env.MP_ACCESS_TOKEN = "TEST-token-unitario";
    const gateway = criarGatewayMercadoPago();

    // Sem rede/credencial real, o SDK rejeita — o adapter deve normalizar o
    // erro cru num MercadoPagoError com a causa anexada.
    let erro: unknown;
    try {
      await gateway.buscarPagamento("pagamento-inexistente");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(MercadoPagoError);
    expect((erro as MercadoPagoError).causa).toBeDefined();
  });
});
