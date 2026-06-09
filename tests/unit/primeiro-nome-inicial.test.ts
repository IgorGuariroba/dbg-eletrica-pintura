import { describe, expect, it } from "vitest";
import { primeiroNomeInicial } from "@/lib/nome";

describe("primeiroNomeInicial", () => {
  it("retorna primeiro nome + inicial do sobrenome", () => {
    expect(primeiroNomeInicial("Mariana Beatriz Silva")).toBe("Mariana S.");
    expect(primeiroNomeInicial("Rodrigo Souza")).toBe("Rodrigo S.");
  });

  it("nome único retorna só o primeiro nome, sem inicial", () => {
    expect(primeiroNomeInicial("Carla")).toBe("Carla");
  });

  it("normaliza espaços extras e capitalização", () => {
    expect(primeiroNomeInicial("  ana   paula  ")).toBe("Ana P.");
  });

  it("string vazia retorna 'Cliente'", () => {
    expect(primeiroNomeInicial("")).toBe("Cliente");
    expect(primeiroNomeInicial("   ")).toBe("Cliente");
  });
});
