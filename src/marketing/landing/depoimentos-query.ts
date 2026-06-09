// Consulta de depoimentos para landings. Expõe avaliações qualificadas
// (nota ≥ NOTA_MINIMA_QUALIFICACAO, não invalidadas, com comentário) com o
// nome do cliente reduzido a "Primeiro S." — sem vazar PII na página pública.

export interface DepoimentoCandidato {
  avaliacaoId: string;
  nome: string;
  texto: string;
  nota: number;
}

export interface DepoimentosQuery {
  /** Candidatos qualificados para cherry-pick no admin (mais recentes primeiro). */
  listarCandidatos(limit?: number): Promise<DepoimentoCandidato[]>;

  /**
   * Resolve uma lista de ids de avaliação para depoimentos, preservando a
   * ordem informada e descartando ids que não qualificam mais (ex.: nota
   * abaixo do mínimo, invalidada, ou sem comentário).
   */
  porIds(avaliacaoIds: string[]): Promise<DepoimentoCandidato[]>;
}
