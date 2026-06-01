"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { carregarParaCliente } from "@/operacao/aprovacao";
import { criarAprovacaoRepoDrizzle } from "@/operacao/aprovacao-repo-drizzle";
import { listarSlotsDisponiveis } from "@/operacao/slots-loader";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { reservarSlot, SlotIndisponivelError } from "@/operacao/reserva-slot";
import { criarReservaSlotRepoDrizzle } from "@/operacao/reserva-slot-repo-drizzle";
import {
  DIAS_AGENDAMENTO,
  validarOsAgendavel,
  escolherSlot,
  slotsPorHorario,
} from "@/operacao/agendamento-cliente";

export interface SlotOferecido {
  inicioISO: string;
}

/** Slots dos próximos 14 dias para a categoria da OS, com técnico oculto. */
async function derivarSlots(token: string, osId: string) {
  const view = await carregarParaCliente(token, criarAprovacaoRepoDrizzle(db));
  const os = validarOsAgendavel(view, osId);

  const inicio = new Date();
  const fim = new Date(inicio.getTime() + DIAS_AGENDAMENTO * 24 * 60 * 60 * 1000);

  const slots = await listarSlotsDisponiveis(
    db,
    { inicio, fim, categoria: os.categoria },
    { configRepo: criarOperacaoConfigRepoDrizzle(db) },
  );
  return slots;
}

export async function listarSlotsOsAction(
  token: string,
  osId: string,
): Promise<SlotOferecido[]> {
  const slots = slotsPorHorario(await derivarSlots(token, osId));
  return slots.map((s) => ({ inicioISO: s.inicio.toISOString() }));
}

export async function agendarOsAction(
  token: string,
  osId: string,
  inicioISO: string,
): Promise<void> {
  // Re-deriva os slots no servidor para obter o técnico sugerido — o cliente
  // só envia o horário escolhido, nunca o técnico.
  const slots = await derivarSlots(token, osId);
  const slot = escolherSlot(slots, inicioISO);

  try {
    await reservarSlot(
      {
        osId,
        tecnicoId: slot.tecnicoId,
        agendadoPara: slot.inicio,
        atorEmail: `cliente:${token}`,
      },
      { reservaRepo: criarReservaSlotRepoDrizzle(db) },
    );
  } catch (e) {
    if (e instanceof SlotIndisponivelError) {
      throw new Error("Esse horário acabou de ser reservado. Escolha outro.");
    }
    throw e;
  }

  revalidatePath(`/s/${token}`);
}
