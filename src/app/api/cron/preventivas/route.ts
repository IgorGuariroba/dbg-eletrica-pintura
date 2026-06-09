import { NextResponse } from "next/server";
import { gerarPreventivasDevidas } from "@/assinatura/preventiva-geracao";
import { criarPreventivaGeracaoRepoDrizzle } from "@/assinatura/preventiva-geracao-drizzle";
import { db } from "@/db/client";

/**
 * Cron diário (#60): gera as OS PREVENTIVA devidas das assinaturas ativas.
 * Protegido pelo `CRON_SECRET` que a Vercel envia em `Authorization: Bearer`.
 *
 * Fail-closed: sem segredo configurado, nega — não há como autenticar a origem.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron não configurado" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const res = await gerarPreventivasDevidas(
    criarPreventivaGeracaoRepoDrizzle(db),
  );
  return NextResponse.json({ ok: true, ...res });
}
