"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { exigirMarketing } from "../guard";
import { criarTratativaRepoDrizzle } from "@/marketing/tratativa-repo-drizzle";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo-drizzle";
import { resolverTratativa } from "@/marketing/resolver-tratativa";
import { enviarReavaliacaoPorOsId } from "@/marketing/enviar-reavaliacao";
import type { TipoComunicado } from "@/marketing/tratativa-repo";

export async function criarTratativaAction(
  alertaAvaliacaoId: string,
  osId: string,
  tipo: TipoComunicado,
  descricao: string,
  responsavelId: string | null,
  data: string, // ISO string
): Promise<{ erro?: string }> {
  await exigirMarketing();
  try {
    const repo = criarTratativaRepoDrizzle(db);
    await repo.criar({
      alertaAvaliacaoId,
      osId,
      tipo,
      descricao,
      responsavelId: responsavelId || null,
      data: new Date(data),
    });
    revalidatePath("/admin/marketing/avaliacoes");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar tratativa" };
  }
}

export async function resolverAlertaAction(
  alertaAvaliacaoId: string,
): Promise<{ erro?: string }> {
  await exigirMarketing();
  try {
    await resolverTratativa(alertaAvaliacaoId, {
      db,
      enviarReavaliacao: enviarReavaliacaoPorOsId,
    });
    revalidatePath("/admin/marketing/avaliacoes");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao resolver alerta" };
  }
}

export async function invalidarAvaliacaoAction(
  osId: string,
  motivo: string,
): Promise<{ erro?: string }> {
  const session = await exigirMarketing();
  try {
    const repo = criarAvaliacaoRepoDrizzle(db);
    await repo.invalidarAvaliacao(osId, motivo, session.user?.email ?? "admin");
    revalidatePath("/admin/marketing/avaliacoes");
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao invalidar avaliação" };
  }
}
