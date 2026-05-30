import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  cliente,
  confirmacaoPresenca,
  membro,
  ordemServico,
  solicitacao,
} from "@/db/schema";

/** Detalhe da OS para a tela de rastreamento do técnico (com presença + contato). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.isTecnico) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [row] = await db
    .select({
      estado: ordemServico.estado,
      clienteNome: cliente.nome,
      whatsapp: cliente.whatsapp,
      endereco: solicitacao.endereco,
      tecnicoNome: membro.nome,
      presencaEm: confirmacaoPresenca.confirmadoEm,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
    .leftJoin(
      confirmacaoPresenca,
      eq(confirmacaoPresenca.osId, ordemServico.id),
    )
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // OS Complementares vinculadas a esta OS (histórico do pai).
  const complementares = await db
    .select({
      id: ordemServico.id,
      estado: ordemServico.estado,
      categoria: ordemServico.categoria,
    })
    .from(ordemServico)
    .where(eq(ordemServico.osPaiId, id));

  const e = row.endereco;
  const endereco = [
    e.logradouro,
    e.numero,
    e.bairro,
    `${e.cidade}/${e.uf}`,
  ]
    .filter(Boolean)
    .join(", ");

  return NextResponse.json({
    estado: row.estado,
    clienteNome: row.clienteNome,
    whatsapp: row.whatsapp,
    endereco,
    tecnicoNome: row.tecnicoNome ?? "DBG",
    presencaConfirmada: row.presencaEm != null,
    complementares,
  });
}
