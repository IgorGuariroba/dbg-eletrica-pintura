import { describe, expect, it } from "vitest";
import {
  cadenciaMeses,
  proximaPreventivaDevida,
} from "@/assinatura/preventiva-cadencia";

describe("cadenciaMeses", () => {
  it("4 preventivas/ano = a cada 3 meses", () => {
    expect(cadenciaMeses(4)).toBe(3);
  });

  it("2 preventivas/ano = a cada 6 meses", () => {
    expect(cadenciaMeses(2)).toBe(6);
  });

  it("plano sem preventivas (0) nunca tem cadência", () => {
    expect(cadenciaMeses(0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("proximaPreventivaDevida", () => {
  const inicio = new Date("2026-01-01T00:00:00Z");

  it("Premium (4/ano): devida ~3 meses após a última", () => {
    const ultima = new Date("2026-03-01T00:00:00Z");
    const hoje = new Date("2026-06-02T00:00:00Z");
    const devida = proximaPreventivaDevida(inicio, ultima, 4, hoje);
    expect(devida).toEqual(new Date("2026-06-01T00:00:00Z"));
  });

  it("não devida enquanto a cadência não venceu", () => {
    const ultima = new Date("2026-03-01T00:00:00Z");
    const hoje = new Date("2026-05-15T00:00:00Z");
    expect(proximaPreventivaDevida(inicio, ultima, 4, hoje)).toBeNull();
  });

  it("sem última, a primeira conta a partir do início da assinatura", () => {
    const hoje = new Date("2026-04-02T00:00:00Z");
    const devida = proximaPreventivaDevida(inicio, null, 4, hoje);
    expect(devida).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("plano sem preventivas nunca fica devida", () => {
    const hoje = new Date("2027-01-01T00:00:00Z");
    expect(proximaPreventivaDevida(inicio, null, 0, hoje)).toBeNull();
  });
});
