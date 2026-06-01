"use server";

import { db } from "@/db/client";
import { exigirOperacao } from "../guard";
import { auth } from "@/auth";
import { cancelarLoteAdmin } from "@/operacao/reagendamento-lote";
import { criarReagendamentoRepoDrizzle } from "@/operacao/reagendamento-repo-drizzle";
import { revalidatePath } from "next/cache";
import { listarSlotsDisponiveis } from "@/operacao/slots-loader";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { slotsPorHorario, DIAS_AGENDAMENTO, escolherSlot } from "@/operacao/agendamento-cliente";
import { eq } from "drizzle-orm";
import { ordemServico } from "@/db/schema";

export async function cancelarLoteAction(
  osIds: string[],
  motivo: string,
): Promise<{ osId: string; ok: boolean; erro?: string }[]> {
  await exigirOperacao();
  const session = await auth();
  const email = session?.user?.email ?? "admin@dbg.com";

  const repo = criarReagendamentoRepoDrizzle(db);
  const result = await cancelarLoteAdmin(osIds, { email }, motivo, repo);
  revalidatePath("/admin/operacao/agenda");
  return result;
}

export async function listarSlotsOsAdminAction(osId: string) {
  await exigirOperacao();

  const [os] = await db
    .select({ categoria: ordemServico.categoria })
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);

  if (!os) throw new Error("OS não encontrada");

  const inicio = new Date();
  const fim = new Date(inicio.getTime() + DIAS_AGENDAMENTO * 24 * 60 * 60 * 1000);

  const slots = await listarSlotsDisponiveis(
    db,
    { inicio, fim, categoria: os.categoria },
    { configRepo: criarOperacaoConfigRepoDrizzle(db) },
  );

  const oferecidos = slotsPorHorario(slots);
  return oferecidos.map((s) => ({
    inicioISO: s.inicio.toISOString(),
  }));
}

export async function reagendarLinhaAction(
  osId: string,
  novoSlotISO: string,
): Promise<{ erro?: string }> {
  try {
    await exigirOperacao();
    const session = await auth();
    const email = session?.user?.email ?? "admin@dbg.com";
    const repo = criarReagendamentoRepoDrizzle(db);

    const [os] = await db
      .select({ categoria: ordemServico.categoria, estado: ordemServico.estado })
      .from(ordemServico)
      .where(eq(ordemServico.id, osId))
      .limit(1);

    if (!os) throw new Error("OS não encontrada");

    const inicio = new Date();
    const fim = new Date(inicio.getTime() + DIAS_AGENDAMENTO * 24 * 60 * 60 * 1000);

    // Re-deriva slots
    const slots = await listarSlotsDisponiveis(
      db,
      { inicio, fim, categoria: os.categoria },
      { configRepo: criarOperacaoConfigRepoDrizzle(db) },
    );

    const slot = escolherSlot(slots, novoSlotISO);

    await repo.reagendar(osId, slot.inicio, {
      estadoAnterior: os.estado,
      estadoNovo: "AGENDADA",
      atorEmail: email,
      motivo: "Reagendamento por Administrador",
      em: new Date(),
    }, slot.tecnicoId);

    revalidatePath("/admin/operacao/agenda");
    return { erro: undefined };
  } catch (err: any) {
    return { erro: err.message ?? "Erro ao reagendar OS" };
  }
}
