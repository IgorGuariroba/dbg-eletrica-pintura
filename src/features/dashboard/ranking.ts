import type { NotaTecnicoView } from "@/marketing/nota-tecnico-repo";

export function rankearTecnicos(
  notas: NotaTecnicoView[],
  opcoes: { minAvaliacoes: number; topN: number }
): NotaTecnicoView[] {
  return notas
    .filter((n) => n.total >= opcoes.minAvaliacoes)
    .sort((a, b) => {
      const mediaA = a.media ?? 0;
      const mediaB = b.media ?? 0;
      if (mediaB !== mediaA) {
        return mediaB - mediaA;
      }
      return b.total - a.total;
    })
    .slice(0, opcoes.topN);
}
