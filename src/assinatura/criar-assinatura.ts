import type { AssinaturaRepo } from "./assinatura-repo";
import type { GatewayAssinatura } from "./gateway";

export interface CriarAssinaturaInput {
  clienteId: string;
  planoId: string;
  /** preApprovalPlanId do MP (template de cobrança do plano). */
  preapprovalPlanIdMp: string;
  payerEmail: string;
  backUrl: string;
}

export interface CriarAssinaturaDeps {
  gateway: GatewayAssinatura;
  repo: AssinaturaRepo;
}

export interface CriarAssinaturaOutput {
  assinaturaId: string;
  preapprovalIdMp: string;
  /** URL de checkout do MP para o cliente autorizar a cobrança. */
  initPoint: string;
}

/**
 * Cria a assinatura recorrente: gera o pre-approval no Mercado Pago e persiste
 * a linha local em PENDENTE (a 1ª autorização chega depois via webhook
 * `authorized`, que promove para ATIVA).
 */
export async function criarAssinatura(
  input: CriarAssinaturaInput,
  deps: CriarAssinaturaDeps,
): Promise<CriarAssinaturaOutput> {
  const mp = await deps.gateway.criarAssinatura({
    preapprovalPlanIdMp: input.preapprovalPlanIdMp,
    payerEmail: input.payerEmail,
    externalReference: input.clienteId,
    backUrl: input.backUrl,
  });

  const { id } = await deps.repo.criar({
    clienteId: input.clienteId,
    planoId: input.planoId,
    preapprovalIdMp: mp.preapprovalIdMp,
  });

  return {
    assinaturaId: id,
    preapprovalIdMp: mp.preapprovalIdMp,
    initPoint: mp.initPoint,
  };
}
