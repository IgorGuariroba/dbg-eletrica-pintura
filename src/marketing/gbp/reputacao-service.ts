/**
 * Serviço de Reputação (Camada 2): combina as avaliações externas do Google
 * Business Profile (via `GatewayGBP`) com a nota interna da DBG (avaliações de
 * OS, Fase 4) para o dashboard comparativo do painel `/admin/marketing/reputacao`.
 */

import type { AvaliacaoGoogle, GatewayGBP } from "./gbp-gateway";

/** Fonte da nota interna agregada da DBG (avaliações de OS válidas). */
export interface FonteReputacaoDbg {
  obterNotaMediaGlobal(): Promise<{ media: number | null; total: number }>;
}

export interface MetricasReputacao {
  /** Nota média das avaliações Google (null se nenhuma). */
  mediaGoogle: number | null;
  totalGoogle: number;
  respondidas: number;
  semResposta: number;
  /** Nota média interna da DBG. */
  mediaDbg: number | null;
  totalDbg: number;
  /** mediaGoogle − mediaDbg (null se faltar alguma das duas). */
  diferenca: number | null;
}

export interface ReputacaoView {
  avaliacoes: AvaliacaoGoogle[];
  metricas: MetricasReputacao;
}

function media(notas: number[]): number | null {
  if (notas.length === 0) return null;
  return notas.reduce((soma, n) => soma + n, 0) / notas.length;
}

export async function obterReputacao(
  gateway: GatewayGBP,
  fonteDbg: FonteReputacaoDbg,
): Promise<ReputacaoView> {
  const [avaliacoes, dbg] = await Promise.all([
    gateway.listarAvaliacoes(),
    fonteDbg.obterNotaMediaGlobal(),
  ]);

  const mediaGoogle = media(avaliacoes.map((a) => a.nota));
  const respondidas = avaliacoes.filter((a) => a.resposta !== null).length;

  const diferenca =
    mediaGoogle !== null && dbg.media !== null
      ? mediaGoogle - dbg.media
      : null;

  return {
    avaliacoes,
    metricas: {
      mediaGoogle,
      totalGoogle: avaliacoes.length,
      respondidas,
      semResposta: avaliacoes.length - respondidas,
      mediaDbg: dbg.media,
      totalDbg: dbg.total,
      diferenca,
    },
  };
}
