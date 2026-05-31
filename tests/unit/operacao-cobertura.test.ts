import { describe, expect, it } from "vitest";
import { normalizarBairro, bairroForaDaCobertura } from "@/operacao/cobertura";

describe("normalizarBairro", () => {
  it("apara espaços e normaliza para minúsculas", () => {
    expect(normalizarBairro("  Centro ")).toBe("centro");
  });

  it("rejeita nome vazio (só espaços)", () => {
    expect(() => normalizarBairro("   ")).toThrow();
  });
});

describe("bairroForaDaCobertura", () => {
  it("retorna true se o bairro não estiver na lista de bairros atendidos", () => {
    expect(bairroForaDaCobertura("Jardim X", ["centro"])).toBe(true);
  });

  it("retorna false se o bairro estiver na lista de bairros atendidos (case/espaço-insensível)", () => {
    expect(bairroForaDaCobertura(" Centro ", ["centro"])).toBe(false);
  });

  it("retorna false se o bairro for vazio, null ou undefined", () => {
    expect(bairroForaDaCobertura(undefined, ["centro"])).toBe(false);
    expect(bairroForaDaCobertura(null, ["centro"])).toBe(false);
    expect(bairroForaDaCobertura("", ["centro"])).toBe(false);
    expect(bairroForaDaCobertura("   ", ["centro"])).toBe(false);
  });

  it("retorna false se a lista de bairros atendidos estiver vazia", () => {
    expect(bairroForaDaCobertura("Centro", [])).toBe(false);
  });
});
