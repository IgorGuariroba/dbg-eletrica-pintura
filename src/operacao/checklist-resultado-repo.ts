import type { StatusChecklist } from "./checklist-conclusao";

export interface ResultadoChecklist {
  osId: string;
  itemId: string;
  descricaoSnapshot: string;
  status: StatusChecklist;
  observacao: string | null;
  fotoUrl: string | null;
}

export interface ChecklistResultadoRepo {
  /** Persiste os resultados de uma OS; reenvio sobrescreve por (osId, itemId). */
  salvarResultados(linhas: ResultadoChecklist[]): Promise<void>;
  listarPorOs(osId: string): Promise<ResultadoChecklist[]>;
}
