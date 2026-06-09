import { describe, expect, it } from "vitest";
import { MetadataOsAusenteError, parsearNotificacao } from "@/pagamento/webhook";

/**
 * O recurso de pagamento que o gateway devolve ao consultar o MP por
 * `payment_id`. Carrega status, valor, método e as OS no metadata.
 */
const recursoBase = {
  id: 123456,
  status: "approved",
  transaction_amount: 250.5,
  payment_method_id: "pix",
  metadata: { os_id: "os-uuid-1" },
};

describe("parsearNotificacao", () => {
  it("extrai paymentId, status, valor, método e osIds (os_id único)", () => {
    const dados = parsearNotificacao(recursoBase);

    expect(dados).toEqual({
      paymentId: "123456",
      status: "approved",
      valor: "250.50",
      metodo: "pix",
      osIds: ["os-uuid-1"],
    });
  });

  it("extrai múltiplas OS de metadata.os_ids (checkout consolidado)", () => {
    const dados = parsearNotificacao({
      ...recursoBase,
      metadata: { os_ids: ["os-1", "os-2"] },
    });

    expect(dados.osIds).toEqual(["os-1", "os-2"]);
  });

  it("propaga assinatura_id do combo (pagar tudo junto + assinar)", () => {
    const dados = parsearNotificacao({
      ...recursoBase,
      metadata: {
        os_ids: ["os-1"],
        assinatura_id: "ass-uuid-1",
        cliente_id: "cli-uuid-1",
      },
    });

    expect(dados.metadata?.assinatura_id).toBe("ass-uuid-1");
    expect(dados.metadata?.cliente_id).toBe("cli-uuid-1");
  });

  it("lança MetadataOsAusenteError quando não há os_id nem os_ids", () => {
    expect(() =>
      parsearNotificacao({ ...recursoBase, metadata: {} }),
    ).toThrow(MetadataOsAusenteError);
  });
});
