import { describe, expect, it } from "vitest";
import { rankearTecnicos } from "@/features/dashboard/ranking";
import type { NotaTecnicoView } from "@/marketing/nota-tecnico-repo";

describe("rankearTecnicos", () => {
  it("filtra técnicos com total de avaliações menor que o mínimo", () => {
    const notas: NotaTecnicoView[] = [
      { tecnicoId: "t-1", tecnicoNome: "Técnico A", media: 5, total: 3 },
      { tecnicoId: "t-2", tecnicoNome: "Técnico B", media: 4, total: 5 },
    ];

    const result = rankearTecnicos(notas, { minAvaliacoes: 5, topN: 5 });

    expect(result).toEqual([
      { tecnicoId: "t-2", tecnicoNome: "Técnico B", media: 4, total: 5 },
    ]);
  });

  it("ordena técnicos por média decrescente e desempatando por total de avaliações decrescente", () => {
    const notas: NotaTecnicoView[] = [
      { tecnicoId: "t-1", tecnicoNome: "Técnico A", media: 4.5, total: 10 },
      { tecnicoId: "t-2", tecnicoNome: "Técnico B", media: 4.8, total: 5 },
      { tecnicoId: "t-3", tecnicoNome: "Técnico C", media: 4.5, total: 15 },
    ];

    const result = rankearTecnicos(notas, { minAvaliacoes: 5, topN: 5 });

    expect(result).toEqual([
      { tecnicoId: "t-2", tecnicoNome: "Técnico B", media: 4.8, total: 5 },
      { tecnicoId: "t-3", tecnicoNome: "Técnico C", media: 4.5, total: 15 },
      { tecnicoId: "t-1", tecnicoNome: "Técnico A", media: 4.5, total: 10 },
    ]);
  });

  it("limita o ranking ao topN informado", () => {
    const notas: NotaTecnicoView[] = [
      { tecnicoId: "t-1", tecnicoNome: "T-1", media: 5, total: 5 },
      { tecnicoId: "t-2", tecnicoNome: "T-2", media: 4.9, total: 5 },
      { tecnicoId: "t-3", tecnicoNome: "T-3", media: 4.8, total: 5 },
      { tecnicoId: "t-4", tecnicoNome: "T-4", media: 4.7, total: 5 },
      { tecnicoId: "t-5", tecnicoNome: "T-5", media: 4.6, total: 5 },
      { tecnicoId: "t-6", tecnicoNome: "T-6", media: 4.5, total: 5 },
    ];

    const result = rankearTecnicos(notas, { minAvaliacoes: 5, topN: 5 });

    expect(result).toHaveLength(5);
    expect(result[result.length - 1].tecnicoId).toBe("t-5");
  });
});
