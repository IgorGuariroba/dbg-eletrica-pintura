"use server";

import { db } from "@/db/client";
import { exigirPortal } from "@/portal/guard";
import {
  cancelarOsCliente,
  reagendarOsCliente,
  ForaDaJanelaError,
} from "@/operacao/reagendamento";
import { criarReagendamentoRepoDrizzle } from "@/operacao/reagendamento-repo-drizzle";
import { revalidatePath } from "next/cache";
import { listarSlotsDisponiveis } from "@/operacao/slots-loader";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { slotsPorHorario, DIAS_AGENDAMENTO, escolherSlot } from "@/operacao/agendamento-cliente";
import { eq } from "drizzle-orm";
import { ordemServico } from "@/db/schema";

export async function cancelarOsClienteAction(osId: string): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const repo = criarReagendamentoRepoDrizzle(db);
    await cancelarOsCliente(osId, { whatsapp: user.whatsapp! }, repo);
    revalidatePath("/portal");
    return { erro: undefined };
  } catch (err: any) {
    if (err instanceof ForaDaJanelaError) {
      return { erro: "Fora da janela permitida (menos de 24h restantes)" };
    }
    return { erro: err.message ?? "Erro ao cancelar OS" };
  }
}

export async function listarSlotsOsPortalAction(osId: string) {
  try {
    await exigirPortal();

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
  } catch (err: any) {
    throw new Error(err.message ?? "Erro ao carregar slots");
  }
}

export async function reagendarOsClienteAction(
  osId: string,
  novoSlotISO: string,
): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const repo = criarReagendamentoRepoDrizzle(db);

    const [os] = await db
      .select({ categoria: ordemServico.categoria })
      .from(ordemServico)
      .where(eq(ordemServico.id, osId))
      .limit(1);

    if (!os) throw new Error("OS não encontrada");

    const inicio = new Date();
    const fim = new Date(inicio.getTime() + DIAS_AGENDAMENTO * 24 * 60 * 60 * 1000);

    // Re-deriva slots para encontrar o técnico correspondente ao slot
    const slots = await listarSlotsDisponiveis(
      db,
      { inicio, fim, categoria: os.categoria },
      { configRepo: criarOperacaoConfigRepoDrizzle(db) },
    );

    const slot = escolherSlot(slots, novoSlotISO);

    await reagendarOsCliente(osId, { whatsapp: user.whatsapp! }, slot.inicio, slot.tecnicoId, repo);

    revalidatePath("/portal");
    return { erro: undefined };
  } catch (err: any) {
    if (err instanceof ForaDaJanelaError) {
      return { erro: "Fora da janela permitida (menos de 24h restantes)" };
    }
    return { erro: err.message ?? "Erro ao reagendar OS" };
  }
}
