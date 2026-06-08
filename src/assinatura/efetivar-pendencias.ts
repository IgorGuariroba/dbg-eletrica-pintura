import type { AssinaturaRepo } from "./assinatura-repo";
import type { GatewayAssinatura } from "./gateway";

export interface EfetivarPendenciasDeps {
  repo: AssinaturaRepo;
  /** Necessário para o downgrade: baixa o valor recorrente no MP. */
  gatewayAssinatura?: Pick<GatewayAssinatura, "atualizarAssinatura">;
  /** Resolve o preço do plano pendente (downgrade). */
  obterPrecoPlano?: (planoId: string) => Promise<number>;
}

export interface EfetivarPendenciasResultado {
  efetivado: boolean;
  tipo?: "cancelamento" | "downgrade";
}

/**
 * Efetiva, no fim do ciclo pago, a pendência agendada de uma assinatura (slice
 * #58). Disparado pelo webhook do MP (renovação/cancelamento): se a
 * `data_efetivacao` já chegou, aplica o cancelamento (status CANCELADA) ou o
 * downgrade (baixa a recorrência no MP + troca o plano). Idempotente — sem
 * pendência ou antes da data, é no-op. Cancelamento tem precedência sobre
 * downgrade (assinatura encerrando não troca de plano).
 */
export async function efetivarPendencias(
  preapprovalIdMp: string,
  deps: EfetivarPendenciasDeps,
  agora: Date = new Date(),
): Promise<EfetivarPendenciasResultado> {
  const assinatura = await deps.repo.carregarPorPreapproval?.(preapprovalIdMp);
  if (!assinatura?.dataEfetivacao) return { efetivado: false };
  if (assinatura.dataEfetivacao.getTime() > agora.getTime()) {
    return { efetivado: false };
  }

  if (assinatura.cancelamentoPendente) {
    await deps.repo.efetivarCancelamento?.(preapprovalIdMp, agora);
    return { efetivado: true, tipo: "cancelamento" };
  }

  if (assinatura.planoPendenteId) {
    const preco = await deps.obterPrecoPlano?.(assinatura.planoPendenteId);
    if (preco != null) {
      await deps.gatewayAssinatura?.atualizarAssinatura(preapprovalIdMp, preco);
    }
    await deps.repo.efetivarDowngrade?.(
      preapprovalIdMp,
      assinatura.planoPendenteId,
    );
    return { efetivado: true, tipo: "downgrade" };
  }

  return { efetivado: false };
}
