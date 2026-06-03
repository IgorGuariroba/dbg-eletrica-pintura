import { describe, expect, it } from "vitest";
import {
  resolverJanelaGarantia,
  type JanelaGarantiaInput,
} from "@/documentos/janela-garantia";

const ISO = (d: Date) => d.toISOString();

describe("resolverJanelaGarantia", () => {
  it("OS paga: início = pagamento, fim = pagamento + prazo", () => {
    const input: JanelaGarantiaInput = {
      tipo: "NORMAL",
      prazoMeses: 12,
      pagamentoEm: new Date("2026-06-03T12:00:00Z"),
    };

    const j = resolverJanelaGarantia(input);

    expect(ISO(j.inicio)).toBe("2026-06-03T12:00:00.000Z");
    expect(ISO(j.fim)).toBe("2027-06-03T12:00:00.000Z");
    expect(j.prazoMeses).toBe(12);
  });

  it("regarantia (GARANTIA): preserva a janela da OS original, sem resetar o prazo", () => {
    const input: JanelaGarantiaInput = {
      tipo: "GARANTIA",
      // dados da própria OS GARANTIA — devem ser ignorados na janela.
      prazoMeses: 0,
      pagamentoEm: new Date("2026-09-01T12:00:00Z"),
      original: {
        prazoMeses: 12,
        pagamentoEm: new Date("2026-06-03T12:00:00Z"),
      },
    };

    const j = resolverJanelaGarantia(input);

    // fim ancorado no pagamento ORIGINAL + prazo original (não reinicia).
    expect(ISO(j.inicio)).toBe("2026-06-03T12:00:00.000Z");
    expect(ISO(j.fim)).toBe("2027-06-03T12:00:00.000Z");
    expect(j.prazoMeses).toBe(12);
  });

  it("GARANTIA sem âncora original lança (guard de invariante)", () => {
    // No fluxo real, montarJanelaInput nunca produz isto (garante `original`
    // ou retorna null). O guard documenta o contrato e falha alto se violado.
    expect(() =>
      resolverJanelaGarantia({
        tipo: "GARANTIA",
        prazoMeses: 0,
        pagamentoEm: new Date("2026-09-01T12:00:00Z"),
      }),
    ).toThrow(/regarantia exige/i);
  });
});
