import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { criarFilaRepoDrizzle } from "@/operacao/fila-repo-drizzle";

/** OS atribuídas ao técnico logado — fonte do cache local do app de campo. */
export async function GET() {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.isTecnico) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const membro = user.email
    ? await criarMembroRepoDrizzle(db).buscarPorEmail(user.email)
    : null;
  if (!membro) return NextResponse.json({ itens: [] });

  const itens = await criarFilaRepoDrizzle(db).listarPorTecnico(membro.id);
  return NextResponse.json({ itens });
}
