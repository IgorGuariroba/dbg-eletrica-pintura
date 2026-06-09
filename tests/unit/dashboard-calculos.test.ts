import { describe, expect, it } from "vitest";
import { calcularPct } from "@/features/dashboard/calculos";

describe("calcularPct", () => {
  it("retorna a fração numerador/denominador", () => {
    expect(calcularPct(3, 4)).toBe(0.75);
  });

  it("retorna null quando o denominador é zero (sem base de cálculo)", () => {
    expect(calcularPct(0, 0)).toBeNull();
    expect(calcularPct(5, 0)).toBeNull();
  });
});
