import type { AssinaturaRepo } from "./assinatura-repo";
import type { GatewayAssinatura } from "./gateway";

export interface CancelarAssinaturaDeps {
  gateway: GatewayAssinatura;
  repo: AssinaturaRepo;
}

export class MotivoCancelamentoObrigatorioError extends Error {
  readonly status = 400;
  constructor() {
    super("Motivo de cancelamento é obrigatório");
    this.name = "MotivoCancelamentoObrigatorioError";
  }
}

/**
 * Cancela a assinatura no Mercado Pago e reflete CANCELADA no banco. O motivo
 * é obrigatório (gestão/auditoria). O cancelamento de preventivas futuras é do
 * slice #58 — aqui só encerramos a cobrança.
 */
export async function cancelarAssinatura(
  preapprovalIdMp: string,
  motivo: string,
  deps: CancelarAssinaturaDeps,
  agora: Date = new Date(),
): Promise<void> {
  if (!motivo.trim()) throw new MotivoCancelamentoObrigatorioError();

  await deps.gateway.cancelarAssinatura(preapprovalIdMp, motivo);
  await deps.repo.atualizarStatus(preapprovalIdMp, {
    status: "CANCELADA",
    canceladoEm: agora,
    motivoCancelamento: motivo,
  });
}
