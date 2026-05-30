import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { ordemServico, solicitacao } from "@/db/schema";
import { confirmarPresenca } from "@/operacao/presenca";
import { criarPresencaRepoDrizzle } from "@/operacao/presenca-repo-drizzle";

/**
 * Confirmação de presença pelo cliente no link público (sem login). Só vale
 * para OS em A_CAMINHO da Solicitação do token. Idempotente.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { osId } = (await request.json()) as { osId?: string };
  if (!osId) {
    return NextResponse.json({ error: "osId obrigatório" }, { status: 400 });
  }

  const [os] = await db
    .select({ id: ordemServico.id, estado: ordemServico.estado })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .where(and(eq(ordemServico.id, osId), eq(solicitacao.token, token)))
    .limit(1);

  if (!os) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (os.estado !== "A_CAMINHO") {
    return NextResponse.json(
      { error: "OS não está aguardando chegada do técnico" },
      { status: 409 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido";

  const { jaConfirmado } = await confirmarPresenca(
    osId,
    ip,
    criarPresencaRepoDrizzle(db),
  );
  return NextResponse.json({ jaConfirmado });
}
