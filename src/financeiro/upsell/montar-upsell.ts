import type { PlanoUpsell } from "./upsell-repo";

export interface OfertaUpsell {
  planoNome: string;
  planoSlug: string;
  /** Mensalidade do plano (string decimal, ex: "179.00"). */
  precoMensal: string;
  percentualDesconto: number;
  /** Quanto a soma pagável custaria com o desconto do plano. */
  valorComDesconto: string;
  /** Diferença entre a soma pagável e o valor com desconto. */
  economia: string;
  /** Social proof: "X clientes já assinaram". */
  totalAssinantes: number;
}

/**
 * Monta o card de upsell do checkout: economia visível ("com o plano X, esse
 * serviço sairia R$Y em vez de R$Z") + social proof. Aritmética em cents para
 * evitar drift de ponto flutuante (mesmo padrão de montarCheckoutConsolidado).
 */
export function montarOfertaUpsell(params: {
  somaPagavel: string;
  plano: PlanoUpsell;
  totalAssinantes: number;
}): OfertaUpsell {
  const somaCents = Math.round(parseFloat(params.somaPagavel) * 100);
  const desconto = Number(params.plano.percentualDesconto);
  const economiaCents = Math.round((somaCents * desconto) / 100);

  return {
    planoNome: params.plano.nome,
    planoSlug: params.plano.slug,
    precoMensal: params.plano.preco,
    percentualDesconto: desconto,
    valorComDesconto: ((somaCents - economiaCents) / 100).toFixed(2),
    economia: (economiaCents / 100).toFixed(2),
    totalAssinantes: params.totalAssinantes,
  };
}
