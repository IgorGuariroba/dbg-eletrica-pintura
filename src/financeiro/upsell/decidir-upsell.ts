export interface DecidirUpsellParams {
  /** Cliente tem alguma assinatura ATIVA (qualquer plano). */
  assinanteAtivo: boolean;
  /** Última vez que o upsell foi exibido a este cliente (null = nunca). */
  upsellVistoEm: Date | null;
  agora: Date;
  /** Dias até o upsell poder reaparecer após uma exibição. */
  prazoReexibicaoDias: number;
}

/**
 * Regra de exibição do upsell de assinatura (issue #65): assinante ativo nunca
 * vê; não-assinante vê na primeira vez e de novo só após o prazo de reexibição.
 */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const PRAZO_REEXIBICAO_DEFAULT_DIAS = 90;

/**
 * Prazo (dias) até o upsell poder reaparecer, configurável via env
 * `UPSELL_REEXIBICAO_DIAS` (decisão D2 da issue #65). Default: 90.
 */
export function prazoReexibicaoDias(): number {
  const valor = Number(process.env.UPSELL_REEXIBICAO_DIAS);
  return Number.isFinite(valor) && valor > 0
    ? valor
    : PRAZO_REEXIBICAO_DEFAULT_DIAS;
}

export function decidirExibirUpsell(params: DecidirUpsellParams): boolean {
  if (params.assinanteAtivo) return false;
  if (params.upsellVistoEm === null) return true;

  const decorridoDias =
    (params.agora.getTime() - params.upsellVistoEm.getTime()) / MS_POR_DIA;
  return decorridoDias > params.prazoReexibicaoDias;
}
