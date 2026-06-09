/**
 * OAuth2 do Google Business Profile (Reputação Camada 2). O fluxo de
 * consentimento é manual e único: o Diego autoriza a conta Google do negócio
 * (escopo `business.manage`), o callback troca o `code` por tokens e o
 * `refresh_token` é guardado em env (`GBP_REFRESH_TOKEN`) — ver doc do PR.
 *
 * Em runtime o gateway só precisa de um access token fresco: `refresh_token`
 * é longevo, `access_token` dura ~1h. `renovarAccessTokenGBP` troca um pelo
 * outro a cada chamada (sem cache nesta slice — otimização é follow-up).
 */

import { erroResposta } from "@/lib/http-erro";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ESCOPO_GBP = "https://www.googleapis.com/auth/business.manage";

/**
 * URL de consentimento para o passo manual do Diego. `access_type=offline` +
 * `prompt=consent` garantem que o Google devolva um `refresh_token`.
 */
export function urlConsentimentoGBP(redirectUri: string): string {
  const clientId = process.env.GBP_CLIENT_ID;
  if (!clientId) {
    throw new Error("GBP_CLIENT_ID não configurada");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ESCOPO_GBP,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface TokensGBP {
  accessToken: string;
  refreshToken: string | null;
  expiraEmSegundos: number;
}

/** Troca o `code` do callback por tokens (passo manual de autorização). */
export async function trocarCodePorTokensGBP(
  code: string,
  redirectUri: string,
): Promise<TokensGBP> {
  const clientId = process.env.GBP_CLIENT_ID;
  const clientSecret = process.env.GBP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GBP_CLIENT_ID/GBP_CLIENT_SECRET não configuradas");
  }
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    throw await erroResposta(resp, "Troca code→token falhou");
  }
  const json = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiraEmSegundos: json.expires_in,
  };
}

/**
 * Renova o access token a partir do `refresh_token` persistido. Lança erro
 * descritivo se o refresh falhar (token revogado/expirado) — o gateway propaga
 * e o painel mostra o estado de credencial inválida.
 */
export async function renovarAccessTokenGBP(): Promise<string> {
  const clientId = process.env.GBP_CLIENT_ID;
  const clientSecret = process.env.GBP_CLIENT_SECRET;
  const refreshToken = process.env.GBP_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais OAuth do GBP não configuradas");
  }
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    throw await erroResposta(
      resp,
      "Refresh do access token GBP falhou — reautorize o OAuth (refresh_token revogado ou expirado)",
    );
  }
  const json = (await resp.json()) as { access_token: string };
  return json.access_token;
}
