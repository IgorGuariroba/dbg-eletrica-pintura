import { describe, expect, it } from "vitest";
import { calcularDimensoesFoto } from "@/features/campo/comprimir-foto";

describe("calcularDimensoesFoto", () => {
  it("reduz o lado maior para o máximo preservando a proporção (paisagem)", () => {
    expect(calcularDimensoesFoto(4000, 3000, 1600)).toEqual({
      largura: 1600,
      altura: 1200,
    });
  });

  it("reduz o lado maior quando é a altura (retrato)", () => {
    expect(calcularDimensoesFoto(3000, 4000, 1600)).toEqual({
      largura: 1200,
      altura: 1600,
    });
  });

  it("não amplia imagens menores que o máximo", () => {
    expect(calcularDimensoesFoto(800, 600, 1600)).toEqual({
      largura: 800,
      altura: 600,
    });
  });
});
