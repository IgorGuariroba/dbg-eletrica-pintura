import { describe, expect, it } from "vitest";
import { qualificarAvaliacoes, notasParaAlerta } from "@/marketing/filtro-avaliacao";

describe("Filtro Inteligente - qualificarAvaliacoes", () => {
  it("A1 — tracer: todas as notas da solicitação >= 4 devem qualificar", () => {
    const result = qualificarAvaliacoes([4, 5]);
    expect(result).toEqual({ qualificada: true });
  });

  it("A2: qualquer nota <= 3 desqualifica a solicitação inteira", () => {
    const result = qualificarAvaliacoes([5, 3]);
    expect(result).toEqual({ qualificada: false });
  });

  it("A3: sem notas não deve qualificar a solicitação", () => {
    const result = qualificarAvaliacoes([]);
    expect(result).toEqual({ qualificada: false });
  });
});

describe("Filtro Inteligente - notasParaAlerta", () => {
  it("A4: notasParaAlerta retorna apenas OSs com notas <= 3", () => {
    const inputs = [
      { osId: "os-1", nota: 3 },
      { osId: "os-2", nota: 5 },
      { osId: "os-3", nota: 1 },
      { osId: "os-4", nota: 4 },
    ];
    const result = notasParaAlerta(inputs);
    expect(result).toEqual([
      { osId: "os-1", nota: 3 },
      { osId: "os-3", nota: 1 },
    ]);
  });
});
