"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { devolverOs, pegarOs } from "@/operacao/fila";
import { criarFilaRepoDrizzle } from "@/operacao/fila-repo-drizzle";
import { NaoTecnicoError } from "@/operacao/fila-repo";
import { exigirFila } from "../guard";

function repo() {
  return criarFilaRepoDrizzle(db);
}

export async function pegarOsAction(osId: string): Promise<void> {
  const { usuario } = await exigirFila();
  // Técnico sem registro em `membro` (ex.: admin raiz) não pode se atribuir.
  if (!usuario.membroId) throw new NaoTecnicoError();
  await pegarOs(osId, usuario, repo());
  revalidatePath("/painel/fila");
}

export async function devolverOsAction(
  osId: string,
  motivo: string,
): Promise<void> {
  const { usuario } = await exigirFila();
  if (!usuario.membroId) throw new NaoTecnicoError();
  await devolverOs(osId, usuario, motivo, repo());
  revalidatePath("/painel/fila");
}
