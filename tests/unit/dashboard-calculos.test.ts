import { describe, expect, it } from "vitest";
import { calcularPct, calcularMrr } from "@/features/dashboard/calculos";

describe("calcularPct", () => {
  it("retorna a fração numerador/denominador", () => {
    expect(calcularPct(3, 4)).toBe(0.75);
  });

  it("retorna null quando o denominador é zero (sem base de cálculo)", () => {
    expect(calcularPct(0, 0)).toBeNull();
    expect(calcularPct(5, 0)).toBeNull();
  });
});

describe("calcularMrr", () => {
  it("soma os preços das assinaturas ativas (precisão em centavos)", () => {
    expect(calcularMrr([{ preco: "99.90" }, { preco: "149.90" }])).toBe("249.80");
  });

  it("retorna 0,00 quando não há assinaturas ativas", () => {
    expect(calcularMrr([])).toBe("0.00");
  });

  it("uma assinatura a menos reduz o MRR pelo preço dela", () => {
    const todas = [{ preco: "99.90" }, { preco: "149.90" }];
    const semUma = [{ preco: "99.90" }];
    expect(calcularMrr(todas)).toBe("249.80");
    expect(calcularMrr(semUma)).toBe("99.90");
  });
});
