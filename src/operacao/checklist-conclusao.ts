import type { statusChecklistEnum } from "@/db/schema";

export type StatusChecklist = (typeof statusChecklistEnum.enumValues)[number];

/** Item do template relevante para a regra de conclusão. */
export interface ItemChecklist {
  id: string;
  exigeFoto: boolean;
}

/** Resposta do técnico para um item (status + se já há foto anexada). */
export interface RespostaChecklist {
  status: StatusChecklist;
  temFoto: boolean;
}

export interface ResultadoConclusao {
  pode: boolean;
  /** ids dos itens que ainda bloqueiam a conclusão. */
  faltam: string[];
}

/**
 * Decide se o checklist pode ser concluído. Foto é obrigatória quando o item
 * pede foto (status OK) ou quando o técnico marcou PROBLEMA. N/A dispensa foto.
 */
export function avaliarConclusao(
  itens: ItemChecklist[],
  respostas: Record<string, RespostaChecklist>,
): ResultadoConclusao {
  const faltam: string[] = [];
  for (const item of itens) {
    const r = respostas[item.id];
    if (!r) {
      faltam.push(item.id);
      continue;
    }
    if (r.status === "NA") continue;
    const fotoObrigatoria = r.status === "PROBLEMA" || item.exigeFoto;
    if (fotoObrigatoria && !r.temFoto) faltam.push(item.id);
  }
  return { pode: faltam.length === 0, faltam };
}
