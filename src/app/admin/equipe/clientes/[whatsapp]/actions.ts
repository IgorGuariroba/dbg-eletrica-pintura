"use server";

import { revalidatePath } from "next/cache";
import { exigirEquipe } from "../../guard";
import { db } from "@/db/client";
import { desvincular } from "@/cliente/vinculacao";
import { criarVinculacaoRepoDrizzle } from "@/cliente/vinculacao-repo-drizzle";

export async function desvincularGoogleAction(whatsapp: string) {
  const session = await exigirEquipe();
  if (!session?.user?.email) {
    return { erro: "Não autorizado." };
  }

  const repo = criarVinculacaoRepoDrizzle(db);

  try {
    const sucesso = await desvincular(
      { whatsapp, atorEmail: session.user.email },
      repo
    );
    if (!sucesso) {
      return { erro: "Cliente não encontrado ou não possui vínculo ativo." };
    }
    
    revalidatePath(`/admin/equipe/clientes/${whatsapp}`);
    return { sucesso: true };
  } catch (e) {
    return { erro: "Erro ao desvincular: " + (e as Error).message };
  }
}
