import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadServiceSolicitacaoR2, type TipoFotoOs } from "@/operacao/r2-privado";

/**
 * Assina o upload de uma foto de execução para o R2 privado. O cliente envia o
 * JPEG comprimido direto para a URL assinada quando estiver online.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.isTecnico) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { tipo } = (await request.json()) as { tipo?: string };
  if (tipo !== "ANTES" && tipo !== "DEPOIS") {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  const { uploadUrl, key } = await uploadServiceSolicitacaoR2().assinarUploadFotoOs({
    osId: id,
    tipo: tipo as TipoFotoOs,
  });
  return NextResponse.json({ uploadUrl, key });
}
