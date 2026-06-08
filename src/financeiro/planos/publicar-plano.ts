import type { GatewayPlanoMP } from "./gateway-plano";
import type { PlanoRepo } from "./plano-repo";

export interface PublicarPlanoDeps {
  repo: PlanoRepo;
  gateway: GatewayPlanoMP;
}

export interface PublicarPlanoResultado {
  preapprovalPlanIdMp: string;
}

export class PlanoNaoEncontradoError extends Error {
  readonly status = 404;
  constructor() {
    super("Plano não encontrado");
    this.name = "PlanoNaoEncontradoError";
  }
}

/**
 * Espelha o plano no Mercado Pago: cria o template de cobrança (PreApprovalPlan)
 * e grava o `preapprovalPlanIdMp` que o slice #3 usa para gerar a assinatura.
 * Idempotente — plano já espelhado não cria um novo template no MP.
 */
export async function publicarPlano(
  planoId: string,
  deps: PublicarPlanoDeps,
): Promise<PublicarPlanoResultado> {
  const plano = await deps.repo.buscarPorId(planoId);
  if (!plano) throw new PlanoNaoEncontradoError();

  if (plano.preapprovalPlanIdMp) {
    return { preapprovalPlanIdMp: plano.preapprovalPlanIdMp };
  }

  const { preapprovalPlanIdMp } = await deps.gateway.criarPlanoCobranca({
    nome: plano.nome,
    preco: plano.preco,
  });
  await deps.repo.definirPreapprovalPlanIdMp(plano.id, preapprovalPlanIdMp);

  return { preapprovalPlanIdMp };
}
