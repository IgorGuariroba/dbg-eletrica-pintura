import { describe, expect, it } from "vitest";
import { avaliarAcionamentoGarantia } from "@/operacao/garantia/avaliar-acionamento";

describe("avaliarAcionamentoGarantia", () => {
  it("dentro do prazo retorna dentroDoPrazo = true", () => {
    const agora = new Date("2026-06-03T12:00:00Z");
    const ancora = {
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
    };

    const resultado = avaliarAcionamentoGarantia({
      agora,
      ancora,
      temComplementarRejeitado: false,
    });

    expect(resultado.dentroDoPrazo).toBe(true);
    expect(resultado.fim.toISOString()).toBe("2026-08-03T12:00:00.000Z");
    expect(resultado.temComplementarRejeitado).toBe(false);
  });

  it("fora do prazo retorna dentroDoPrazo = false", () => {
    const agora = new Date("2026-08-04T12:00:00Z");
    const ancora = {
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
    };

    const resultado = avaliarAcionamentoGarantia({
      agora,
      ancora,
      temComplementarRejeitado: false,
    });

    expect(resultado.dentroDoPrazo).toBe(false);
    expect(resultado.fim.toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });

  it("propaga flag temComplementarRejeitado", () => {
    const agora = new Date("2026-06-03T12:00:00Z");
    const ancora = {
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
    };

    const resultado = avaliarAcionamentoGarantia({
      agora,
      ancora,
      temComplementarRejeitado: true,
    });

    expect(resultado.temComplementarRejeitado).toBe(true);
  });
});
