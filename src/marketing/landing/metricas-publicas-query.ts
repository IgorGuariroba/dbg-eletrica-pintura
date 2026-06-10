// Métricas públicas da landing principal (prova social quantitativa).
// Números agregados, sem PII: total de OS concluídas (all-time), nota média
// e total de avaliações válidas.

export interface MetricasPublicas {
  osConcluidas: number;
  notaMedia: number | null;
  totalAvaliacoes: number;
}

export interface MetricasPublicasQuery {
  obter(): Promise<MetricasPublicas>;
}
