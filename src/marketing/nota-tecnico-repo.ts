export interface NotaTecnicoView {
  tecnicoId: string;
  tecnicoNome: string | null;
  media: number | null;
  total: number;
}

export interface NotaTecnicoRepo {
  /** Nota média + contagem de avaliações válidas de um técnico específico. */
  obterNotaMedia(tecnicoId: string): Promise<{ media: number | null; total: number } | null>;
  /** Lista nota média por técnico (ignora avaliações inválidas). */
  listarNotasPorTecnico(): Promise<NotaTecnicoView[]>;
}
