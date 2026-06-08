/** Base do ciclo de cobrança recorrente (mensal do MP). */
export const DIAS_CICLO = 30;

const MS_POR_DIA = 86_400_000;

/**
 * Diferença proporcional a cobrar no upgrade imediato: a diferença de preço
 * mensal rateada pelos dias que ainda restam no ciclo já pago. Cobra-se só o
 * "a mais" do plano novo pelo tempo restante. Ciclo expirado → 0 (não há o que
 * ratear; o valor cheio entra no próximo ciclo via `atualizarAssinatura`).
 */
export function calcularDiferencaProporcional(params: {
  precoAtual: number;
  precoNovo: number;
  agora: Date;
  fimCiclo: Date;
  diasCiclo?: number;
}): number {
  const diasCiclo = params.diasCiclo ?? DIAS_CICLO;
  const diasRestantes = Math.max(
    0,
    (params.fimCiclo.getTime() - params.agora.getTime()) / MS_POR_DIA,
  );
  const proporcao = Math.min(diasRestantes, diasCiclo) / diasCiclo;
  const diff = (params.precoNovo - params.precoAtual) * proporcao;
  return Math.round(diff * 100) / 100;
}
