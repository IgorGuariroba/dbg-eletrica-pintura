import { NextResponse } from "next/server";
import { exigirMarketing } from "@/app/admin/marketing/guard";
import { trocarCodePorTokensGBP } from "@/lib/gbp-oauth";

/**
 * Callback do consentimento OAuth do Google Business Profile (passo manual,
 * único — ver doc do PR). Troca o `code` por tokens e devolve o `refresh_token`
 * para o Diego colar em `GBP_REFRESH_TOKEN` (persistência em env nesta slice).
 *
 * Gated pelo módulo Marketing: só um admin autenticado vê o refresh token.
 * O `redirect_uri` precisa bater com o registrado no Google Cloud Console.
 */
export async function GET(request: Request): Promise<NextResponse> {
  await exigirMarketing();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const erroOAuth = url.searchParams.get("error");

  if (erroOAuth) {
    return NextResponse.json(
      { erro: `Consentimento negado pelo Google: ${erroOAuth}` },
      { status: 400 },
    );
  }
  if (!code) {
    return NextResponse.json(
      { erro: "Parâmetro 'code' ausente no callback" },
      { status: 400 },
    );
  }

  const redirectUri = `${url.origin}/api/auth/gbp/callback`;

  try {
    const tokens = await trocarCodePorTokensGBP(code, redirectUri);
    return NextResponse.json({
      ok: true,
      mensagem:
        "Autorização concluída. Copie o refresh_token para a env GBP_REFRESH_TOKEN e reimplante.",
      refreshToken: tokens.refreshToken,
      avisoSemRefreshToken: tokens.refreshToken
        ? undefined
        : "Google não devolveu refresh_token — revogue o acesso em myaccount.google.com e reautorize (precisa de prompt=consent).",
    });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro desconhecido" },
      { status: 502 },
    );
  }
}
