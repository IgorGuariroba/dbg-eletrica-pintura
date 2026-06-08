import type { PlanoRepo } from "@/financeiro/planos/plano-repo";
import type { AssinaturaRepo } from "./assinatura-repo";
import type { ClienteAssinaturaRepo } from "./cliente-assinatura-repo";
import { criarAssinatura } from "./criar-assinatura";
import type { GatewayAssinatura } from "./gateway";

export interface IniciarAssinaturaInput {
  /** Slug do plano (vem da landing /assinar/{slug} ou de /planos). */
  slug: string;
  /** Identidade do cliente autenticado (Google) que está assinando. */
  cliente: { nome: string; whatsapp: string; email: string };
  /** URL de retorno após o checkout do MP. */
  backUrl: string;
}

export interface IniciarAssinaturaDeps {
  planoRepo: Pick<PlanoRepo, "buscarPorSlug">;
  clienteRepo: ClienteAssinaturaRepo;
  gateway: GatewayAssinatura;
  assinaturaRepo: AssinaturaRepo;
}

export type IniciarAssinaturaResultado =
  | { ok: true; assinaturaId: string; initPoint: string }
  | {
      ok: false;
      erro: "PLANO_NAO_ENCONTRADO" | "PLANO_INDISPONIVEL" | "JA_ASSINANTE";
    };

/**
 * Orquestra a venda de assinatura em qualquer canal (digital, QR público ou
 * presencial): resolve o plano pelo slug, garante o cliente (cria se novo) e
 * delega a `criarAssinatura` a criação do pre-approval no MP. A 1ª autorização
 * chega depois via webhook `authorized` (promove PENDENTE → ATIVA).
 */
export async function iniciarAssinaturaPlano(
  input: IniciarAssinaturaInput,
  deps: IniciarAssinaturaDeps,
): Promise<IniciarAssinaturaResultado> {
  const plano = await deps.planoRepo.buscarPorSlug(input.slug);
  if (!plano) return { ok: false, erro: "PLANO_NAO_ENCONTRADO" };
  // Só dá para assinar plano ativo e já espelhado no MP (#56 publica e preenche
  // preapprovalPlanIdMp). Sem isso não há template de cobrança para o checkout.
  if (!plano.ativo || !plano.preapprovalPlanIdMp) {
    return { ok: false, erro: "PLANO_INDISPONIVEL" };
  }

  const clienteExistente = await deps.clienteRepo.buscarPorWhatsapp(
    input.cliente.whatsapp,
  );
  const clienteId =
    clienteExistente?.id ??
    (await deps.clienteRepo.criar(input.cliente)).id;

  // Evita pre-approval duplicado (cobrança dupla) se o cliente já assina o plano.
  if (await deps.assinaturaRepo.assinaturaAtivaDe?.(clienteId, plano.id)) {
    return { ok: false, erro: "JA_ASSINANTE" };
  }

  const out = await criarAssinatura(
    {
      clienteId,
      planoId: plano.id,
      preapprovalPlanIdMp: plano.preapprovalPlanIdMp!,
      payerEmail: input.cliente.email,
      backUrl: input.backUrl,
    },
    { gateway: deps.gateway, repo: deps.assinaturaRepo },
  );

  return {
    ok: true,
    assinaturaId: out.assinaturaId,
    initPoint: out.initPoint,
  };
}
