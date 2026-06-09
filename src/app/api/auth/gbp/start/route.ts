import { NextResponse } from "next/server";
import { exigirMarketing } from "@/app/admin/marketing/guard";
import { urlConsentimentoGBP } from "@/lib/gbp-oauth";

/**
 * Inicia o consentimento OAuth do Google Business Profile: redireciona o admin
 * para a tela de autorização do Google. Passo manual e único (o Diego autoriza
 * a conta do negócio) — o callback (`/api/auth/gbp/callback`) devolve o
 * refresh_token para colar em `GBP_REFRESH_TOKEN`. Ver doc do PR.
 *
 * Gated pelo módulo Marketing. O `redirect_uri` precisa bater com o registrado
 * no Google Cloud Console.
 */
export async function GET(request: Request): Promise<NextResponse> {
  await exigirMarketing();

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/gbp/callback`;

  try {
    return NextResponse.redirect(urlConsentimentoGBP(redirectUri));
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro desconhecido" },
      { status: 500 },
    );
  }
}
