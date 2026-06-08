import { describe, expect, it } from "vitest";
import { calcularDiferencaProporcional } from "@/assinatura/rateio-upgrade";

describe("calcularDiferencaProporcional", () => {
  it("rateia a diferença pelo nº de dias restantes do ciclo (base 30 dias)", async () => {
    // 15 dias restantes de 30 → metade da diferença (R$50 → R$25).
    const diff = calcularDiferencaProporcional({
      precoAtual: 49.9,
      precoNovo: 99.9,
      agora: new Date("2026-06-13T00:00:00Z"),
      fimCiclo: new Date("2026-06-28T00:00:00Z"),
    });

    expect(diff).toBe(25);
  });

  it("arredonda para 2 casas decimais", async () => {
    // 10 dias restantes de 30 → 1/3 de R$50 = 16.6666… → 16.67.
    const diff = calcularDiferencaProporcional({
      precoAtual: 49.9,
      precoNovo: 99.9,
      agora: new Date("2026-06-18T00:00:00Z"),
      fimCiclo: new Date("2026-06-28T00:00:00Z"),
    });

    expect(diff).toBe(16.67);
  });

  it("não rateia valor negativo quando o ciclo já passou", async () => {
    const diff = calcularDiferencaProporcional({
      precoAtual: 49.9,
      precoNovo: 99.9,
      agora: new Date("2026-07-10T00:00:00Z"),
      fimCiclo: new Date("2026-06-28T00:00:00Z"),
    });

    expect(diff).toBe(0);
  });
});
