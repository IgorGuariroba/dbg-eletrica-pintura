import type { AssinaturaRepo } from "./assinatura-repo";
import type { GatewayAssinatura } from "./gateway";

export interface CancelarAssinaturaDeps {
  gateway: Pick<GatewayAssinatura, "cancelarAssinatura">;
  repo: AssinaturaRepo;
  /**
   * Cancela as preventivas agendadas para depois do fim do ciclo. Injetável
   * (default no fluxo de produção liga ao `PreventivaRepo`). Sem ela, o
   * cancelamento só encerra a cobrança e agenda a efetivação.
   */
  cancelarPreventivas?: (assinaturaId: string, fimCiclo: Date) => Promise<void>;
}

export class MotivoCancelamentoObrigatorioError extends Error {
  readonly status = 400;
  constructor() {
    super("Motivo de cancelamento é obrigatório");
    this.name = "MotivoCancelamentoObrigatorioError";
  }
}

export class AssinaturaNaoEncontradaError extends Error {
  readonly status = 404;
  constructor() {
    super("Assinatura não encontrada");
    this.name = "AssinaturaNaoEncontradaError";
  }
}

/**
 * Cancela a assinatura com efeito no FIM do ciclo pago (slice #58): encerra a
 * cobrança recorrente no Mercado Pago imediatamente, agenda a efetivação do
 * status CANCELADA para `fim_ciclo_atual` (a troca de status acontece depois,
 * via webhook) e cancela já as preventivas agendadas para DEPOIS do ciclo. As
 * preventivas dentro do ciclo pago seguem acontecendo. Motivo é obrigatório.
 */
export async function cancelarAssinatura(
  input: { preapprovalIdMp: string; motivo: string },
  deps: CancelarAssinaturaDeps,
  agora: Date = new Date(),
): Promise<void> {
  const motivo = input.motivo.trim();
  if (!motivo) throw new MotivoCancelamentoObrigatorioError();

  const assinatura = await deps.repo.carregarPorPreapproval?.(
    input.preapprovalIdMp,
  );
  if (!assinatura) throw new AssinaturaNaoEncontradaError();

  // Sem ciclo conhecido (assinatura nunca ativada), efetiva já.
  const fimCiclo = assinatura.fimCicloAtual ?? agora;

  await deps.gateway.cancelarAssinatura(input.preapprovalIdMp, motivo);
  await deps.repo.marcarCancelamentoPendente?.(input.preapprovalIdMp, {
    motivo,
    dataEfetivacao: fimCiclo,
  });
  await deps.cancelarPreventivas?.(assinatura.id, fimCiclo);
}
