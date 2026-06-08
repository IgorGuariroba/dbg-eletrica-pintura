import type { AssinaturaRepo } from "./assinatura-repo";
import type { GatewayAssinatura } from "./gateway";

export interface PausarAssinaturaDeps {
  gateway: Pick<GatewayAssinatura, "pausarAssinatura">;
  repo: AssinaturaRepo;
}

/**
 * Pausa a cobrança recorrente no Mercado Pago (ação do admin Financeiro) e
 * reflete PAUSADA no banco. As preventivas já agendadas dentro do ciclo seguem;
 * o MP retoma a cobrança quando a assinatura for despausada.
 */
export async function pausarAssinatura(
  preapprovalIdMp: string,
  deps: PausarAssinaturaDeps,
): Promise<void> {
  await deps.gateway.pausarAssinatura(preapprovalIdMp);
  await deps.repo.atualizarStatus(preapprovalIdMp, { status: "PAUSADA" });
}
