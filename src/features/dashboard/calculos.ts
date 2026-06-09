// Funções puras de agregação do dashboard (testáveis sem banco).

/**
 * Razão numerador/denominador como fração (0..1), ou `null` quando não há
 * base de cálculo (denominador zero) — evita divisão por zero e sinaliza
 * "sem dados" para a UI exibir "—" em vez de 0%.
 */
export function calcularPct(numerador: number, denominador: number): number | null {
  if (denominador === 0) return null;
  return numerador / denominador;
}
