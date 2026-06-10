"use server";

import { db } from "@/db/client";
import { exigirOperacao } from "../guard";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { criarAgendamentoService } from "@/operacao/agendamento";
import { criarAgendamentoRepoDrizzle } from "@/operacao/agendamento-repo-drizzle";

const service = criarAgendamentoService(criarAgendamentoRepoDrizzle(db));

/** E-mail real do operador autenticado — usado como ator no histórico. */
async function emailOperador(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Sessão de operador sem e-mail.");
  return email;
}

export async function cancelarLoteAction(
  osIds: string[],
  motivo: string,
): Promise<{ osId: string; ok: boolean; erro?: string }[]> {
  await exigirOperacao();
  const email = await emailOperador();

  const result = await service.cancelarLoteAdmin(osIds, email, motivo);
  revalidatePath("/admin/operacao/agenda");
  return result;
}

export async function listarSlotsOsAdminAction(osId: string) {
  await exigirOperacao();

  const slots = await service.obterSlotsAdmin(osId);

  return slots.map((s) => ({
    inicioISO: s.inicio.toISOString(),
  }));
}

export async function reagendarLinhaAction(
  osId: string,
  novoSlotISO: string,
  motivo: string,
): Promise<{ erro?: string }> {
  try {
    await exigirOperacao();
    const email = await emailOperador();

    await service.reagendarAdmin(osId, email, new Date(novoSlotISO), motivo);

    revalidatePath("/admin/operacao/agenda");
    return { erro: undefined };
  } catch (err) {
    console.error(`Erro ao reagendar OS ${osId} (admin):`, err);
    return { erro: err instanceof Error ? err.message : "Erro ao reagendar OS" };
  }
}
