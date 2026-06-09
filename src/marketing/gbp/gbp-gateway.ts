/**
 * Porta de saída para a Google Business Profile API (Reputação Camada 2). Isola
 * o HTTP do domínio: serviço e painel dependem desta interface, testável com
 * fake. A factory devolve um mock quando as credenciais OAuth não estão
 * configuradas (mesmo padrão de `criarGatewayWhatsApp`), permitindo rodar o
 * painel em dev/teste sem bater na API real — que só funciona após o negócio
 * ser verificado no Google e o OAuth autorizado (ver doc do PR).
 *
 * A API GBP **não permite postar avaliações** (anti-fraude Google): apenas
 * leitura (`listarAvaliacoes`) e resposta do dono (`responderAvaliacao`).
 */

import { AVALIACOES_GOOGLE_MOCK } from "./gbp-gateway-mock";
import { renovarAccessTokenGBP } from "@/lib/gbp-oauth";
import { erroResposta } from "@/lib/http-erro";

/** Avaliação externa lida do Google Business Profile. */
export interface AvaliacaoGoogle {
  /** `reviewId` do Google — usado para responder. */
  id: string;
  /** Nome de exibição do autor no Google. */
  autor: string;
  /** Nota de 1 a 5 estrelas. */
  nota: number;
  /** Texto da avaliação (pode vir vazio — Google permite só estrela). */
  comentario: string | null;
  /** Quando a avaliação foi publicada. */
  criadoEm: Date;
  /** Resposta do dono já postada, se houver. */
  resposta: string | null;
}

export interface GatewayGBP {
  /** Lista avaliações recentes do perfil Google do negócio. */
  listarAvaliacoes(): Promise<AvaliacaoGoogle[]>;
  /** Posta (ou substitui) a resposta do dono a uma avaliação. */
  responderAvaliacao(reviewId: string, texto: string): Promise<void>;
}

export interface CriarGatewayGBPConfig {
  /** Força o mock mesmo com credenciais presentes (útil em teste). */
  forceMock?: boolean;
}

const GBP_API_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * `true` quando o OAuth do Google Business Profile tem credenciais reais no
 * ambiente. Usado para decidir entre gateway real e mock. Sem credenciais —
 * estado padrão até o Diego verificar o negócio e autorizar — o painel roda
 * sobre dados falsos.
 */
export function gbpConfigurado(): boolean {
  return Boolean(
    process.env.GBP_CLIENT_ID &&
      process.env.GBP_CLIENT_SECRET &&
      process.env.GBP_REFRESH_TOKEN &&
      process.env.GBP_ACCOUNT_ID &&
      process.env.GBP_LOCATION_ID,
  );
}

/**
 * Constrói o gateway real a partir das credenciais OAuth de ambiente
 * (`GBP_*`). Sem elas — ou com `forceMock` — devolve um mock que serve a lista
 * falsa e loga as respostas. O access token é de curta duração: cada chamada
 * real o renova a partir do `refresh_token` (`renovarAccessTokenGBP`).
 */
export function criarGatewayGBP(
  config: CriarGatewayGBPConfig = {},
): GatewayGBP {
  const isMock = config.forceMock || !gbpConfigurado();

  if (isMock) {
    return {
      async listarAvaliacoes() {
        return AVALIACOES_GOOGLE_MOCK;
      },
      async responderAvaliacao(reviewId, texto) {
        console.log(
          `[GatewayGBP MOCK] resposta para review=${reviewId}: "${texto.slice(0, 60)}"`,
        );
      },
    };
  }

  const accountId = process.env.GBP_ACCOUNT_ID!;
  const locationId = process.env.GBP_LOCATION_ID!;
  const parent = `accounts/${accountId}/locations/${locationId}`;

  return {
    async listarAvaliacoes() {
      const accessToken = await renovarAccessTokenGBP();
      const resp = await fetch(`${GBP_API_BASE}/${parent}/reviews`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        throw await erroResposta(resp, "GBP listarAvaliacoes falhou");
      }
      const json = (await resp.json()) as { reviews?: ReviewGBP[] };
      return (json.reviews ?? []).map(mapearReview);
    },

    async responderAvaliacao(reviewId, texto) {
      const accessToken = await renovarAccessTokenGBP();
      const resp = await fetch(
        `${GBP_API_BASE}/${parent}/reviews/${reviewId}/reply`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment: texto }),
        },
      );
      if (!resp.ok) {
        throw await erroResposta(resp, "GBP responderAvaliacao falhou");
      }
    },
  };
}

/** Estrutura crua de uma avaliação na resposta da GBP API. */
interface ReviewGBP {
  reviewId: string;
  reviewer?: { displayName?: string };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string };
}

const ESTRELAS: Record<NonNullable<ReviewGBP["starRating"]>, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function mapearReview(r: ReviewGBP): AvaliacaoGoogle {
  return {
    id: r.reviewId,
    autor: r.reviewer?.displayName ?? "Anônimo",
    nota: r.starRating ? ESTRELAS[r.starRating] : 0,
    comentario: r.comment ?? null,
    criadoEm: r.createTime ? new Date(r.createTime) : new Date(),
    resposta: r.reviewReply?.comment ?? null,
  };
}
