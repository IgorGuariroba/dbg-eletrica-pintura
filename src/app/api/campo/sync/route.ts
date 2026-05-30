import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { processarItemSync } from "@/features/campo/sync";

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.isTecnico || !user.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const items = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid body, expected array" }, { status: 400 });
    }

    const results = [];
    for (const item of items) {
      try {
        const res = await processarItemSync(db, item, user.email);
        results.push({
          id: item.id,
          success: true,
          conflito: res.conflito,
          erro: res.erro,
        });
      } catch (err: any) {
        results.push({
          id: item.id,
          success: false,
          erro: err?.message || "Erro ao processar item",
        });
        // Para manter a consistência FIFO (First In First Out) e garantir que
        // ações dependentes não sejam aplicadas fora de ordem, interrompemos
        // o processamento do lote no primeiro erro.
        break;
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
