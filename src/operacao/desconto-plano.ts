export interface DescontoAplicado {
  /** Valor do desconto (R$, 2 casas). */
  desconto: string;
  /** Total já líquido do desconto (R$, 2 casas). */
  totalLiquido: string;
}

/**
 * Aplica o desconto percentual de um plano de assinatura sobre o total do
 * orçamento. Cálculo em centavos (inteiros) p/ arredondamento determinístico
 * (meia-unidade para cima), evitando o ruído de ponto flutuante.
 */
export function aplicarDescontoPlano(
  total: string,
  percentual: string,
): DescontoAplicado {
  const totalCents = Math.round(Number(total) * 100);
  const pct = Number(percentual);
  const descontoCents = Math.round((totalCents * pct) / 100);
  const liquidoCents = totalCents - descontoCents;
  return {
    desconto: (descontoCents / 100).toFixed(2),
    totalLiquido: (liquidoCents / 100).toFixed(2),
  };
}
