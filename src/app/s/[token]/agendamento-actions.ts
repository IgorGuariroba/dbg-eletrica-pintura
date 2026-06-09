"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { criarAgendamentoService } from "@/operacao/agendamento";
import { criarAgendamentoRepoDrizzle } from "@/operacao/agendamento-repo-drizzle";
import { SlotIndisponivelError } from "@/operacao/agendamento";

export interface SlotOferecido {
  inicioISO: string;
}

const service = criarAgendamentoService(criarAgendamentoRepoDrizzle(db));

export async function listarSlotsOsAction(
  token: string,
  osId: string,
): Promise<SlotOferecido[]> {
  try {
    const slots = await service.obterSlotsCliente(token, osId);
    return slots.map((s) => ({ inicioISO: s.inicio.toISOString() }));
  } catch (error) {
    console.error("Erro ao listar slots para o cliente:", error);
    return [];
  }
}

export async function agendarOsAction(
  token: string,
  osId: string,
  inicioISO: string,
): Promise<void> {
  try {
    await service.agendarCliente(token, osId, new Date(inicioISO));
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      throw new Error("Esse horário acabou de ser reservado. Escolha outro.");
    }
    throw e;
  }

  revalidatePath(`/s/${token}`);
}
