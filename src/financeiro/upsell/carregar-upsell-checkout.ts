import { decidirExibirUpsell, prazoReexibicaoDias } from "./decidir-upsell";
import { montarOfertaUpsell, type OfertaUpsell } from "./montar-upsell";
import type { UpsellRepo } from "./upsell-repo";

export interface CarregarUpsellInput {
  clienteId: string;
  /** Soma das OS pagáveis do checkout — base da economia visível. */
  somaPagavel: string;
  agora?: Date;
}

export interface CarregarUpsellDeps {
  repo: UpsellRepo;
}

/**
 * Loader do card de upsell no checkout consolidado (issue #65): decide pela
 * regra de exibição (assinante nunca vê; reexibe após o prazo), monta a oferta
 * com o plano destaque e marca o cliente como visto no próprio render (D3).
 * Devolve null quando o card não deve aparecer.
 */
export async function carregarUpsellCheckout(
  input: CarregarUpsellInput,
  deps: CarregarUpsellDeps,
): Promise<OfertaUpsell | null> {
  const agora = input.agora ?? new Date();

  const assinanteAtivo = await deps.repo.temAssinaturaAtiva(input.clienteId);
  if (assinanteAtivo) return null;

  const exibir = decidirExibirUpsell({
    assinanteAtivo,
    upsellVistoEm: await deps.repo.upsellVistoEm(input.clienteId),
    agora,
    prazoReexibicaoDias: prazoReexibicaoDias(),
  });
  if (!exibir) return null;

  const plano = await deps.repo.planoDestaque();
  if (!plano) return null;

  const oferta = montarOfertaUpsell({
    somaPagavel: input.somaPagavel,
    plano,
    totalAssinantes: await deps.repo.contarAssinaturasAtivas(),
  });

  await deps.repo.marcarUpsellVisto(input.clienteId, agora);
  return oferta;
}
