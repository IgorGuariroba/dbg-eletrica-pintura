"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { reativarOs } from "@/operacao/reativacao";
import { criarReativacaoRepoDrizzle } from "@/operacao/reativacao-repo-drizzle";
import { exigirFila } from "../../guard";

export async function reativarOsAction(
  osId: string,
  motivo: string,
): Promise<void> {
  const { usuario } = await exigirFila();
  const repo = criarReativacaoRepoDrizzle(db);

  await reativarOs(osId, usuario, motivo, repo);
  revalidatePath(`/painel/os/${osId}`);
}
