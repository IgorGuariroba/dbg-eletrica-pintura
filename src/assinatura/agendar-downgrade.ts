import type { AssinaturaRepo } from "./assinatura-repo";
import { AssinaturaNaoEncontradaError } from "./cancelar-assinatura";

export interface AgendarDowngradeDeps {
  repo: AssinaturaRepo;
}

export class DowngradeInvalidoError extends Error {
  readonly status = 400;
  constructor() {
    super("O plano destino precisa ser mais barato que o atual");
    this.name = "DowngradeInvalidoError";
  }
}

/**
 * Agenda a troca para um plano MAIS BARATO no fim do ciclo pago (slice #58). Não
 * cobra nada nem altera o Mercado Pago agora — o valor recorrente só baixa na
 * efetivação (webhook de renovação). Status permanece ATIVA até lá. Troca para
 * plano igual/mais caro não é downgrade (usar o fluxo de upgrade).
 */
export async function agendarDowngrade(
  input: {
    preapprovalIdMp: string;
    planoAtualPreco: number;
    planoDestino: { id: string; preco: number };
  },
  deps: AgendarDowngradeDeps,
): Promise<void> {
  if (input.planoDestino.preco >= input.planoAtualPreco) {
    throw new DowngradeInvalidoError();
  }

  const assinatura = await deps.repo.carregarPorPreapproval?.(
    input.preapprovalIdMp,
  );
  if (!assinatura) throw new AssinaturaNaoEncontradaError();

  await deps.repo.marcarDowngradePendente?.(input.preapprovalIdMp, {
    planoPendenteId: input.planoDestino.id,
    dataEfetivacao: assinatura.fimCicloAtual ?? new Date(),
  });
}
