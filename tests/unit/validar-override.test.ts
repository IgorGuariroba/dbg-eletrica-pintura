import { describe, expect, it } from "vitest";
import { validarPrecoPromo } from "@/marketing/landing/validar-override";

describe("validarPrecoPromo", () => {
  it("aceita promo vazia/nula (sem promoção)", () => {
    expect(validarPrecoPromo("300.00", null)).toBeNull();
    expect(validarPrecoPromo("300.00", "")).toBeNull();
  });

  it("aceita promo positiva menor que o base", () => {
    expect(validarPrecoPromo("300.00", "199.90")).toBeNull();
  });

  it("rejeita promo maior ou igual ao base", () => {
    expect(validarPrecoPromo("300.00", "300.00")).toMatch(/menor/i);
    expect(validarPrecoPromo("300.00", "350.00")).toMatch(/menor/i);
  });

  it("rejeita promo zero ou negativa", () => {
    expect(validarPrecoPromo("300.00", "0")).toMatch(/maior que zero/i);
    expect(validarPrecoPromo("300.00", "-5")).toMatch(/maior que zero/i);
  });

  it("rejeita promo não-numérica", () => {
    expect(validarPrecoPromo("300.00", "abc")).toMatch(/inválido/i);
  });
});
