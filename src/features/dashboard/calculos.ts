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

/**
 * MRR = soma dos preços das assinaturas ativas. Soma em centavos (inteiros)
 * para evitar erro de ponto flutuante, devolvendo string decimal com 2 casas
 * (mesmo formato monetário usado em todo o domínio).
 */
export function calcularMrr(ativas: { preco: string }[]): string {
  const centavos = ativas.reduce(
    (acc, a) => acc + Math.round(parseFloat(a.preco) * 100),
    0,
  );
  return (centavos / 100).toFixed(2);
}
