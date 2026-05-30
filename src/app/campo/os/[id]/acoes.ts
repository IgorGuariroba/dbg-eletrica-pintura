"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import {
  cancelarOsTecnico,
  reagendarOsTecnico,
} from "@/operacao/reagendamento";
import { criarReagendamentoRepoDrizzle } from "@/operacao/reagendamento-repo-drizzle";

export interface AcaoState {
  erro?: string;
  ok?: boolean;
}

export async function reagendarAction(
  _prev: AcaoState,
  form: FormData,
): Promise<AcaoState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem reagendar" };
  }
  const osId = String(form.get("osId") ?? "");
  const slot = String(form.get("slot") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  if (!osId || !slot) return { erro: "Informe a nova data e horário" };
  const novoSlot = new Date(slot);
  if (Number.isNaN(novoSlot.getTime())) return { erro: "Data inválida" };

  try {
    await reagendarOsTecnico(
      osId,
      { membroId: tecnico.membroId, email: tecnico.email ?? "tecnico" },
      novoSlot,
      motivo || null,
      criarReagendamentoRepoDrizzle(db),
    );
    return { ok: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao reagendar" };
  }
}

export async function cancelarAction(
  _prev: AcaoState,
  form: FormData,
): Promise<AcaoState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem cancelar" };
  }
  const osId = String(form.get("osId") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  if (!osId) return { erro: "OS não informada" };

  try {
    await cancelarOsTecnico(
      osId,
      { membroId: tecnico.membroId, email: tecnico.email ?? "tecnico" },
      motivo,
      criarReagendamentoRepoDrizzle(db),
    );
    return { ok: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao cancelar" };
  }
}

/** EM_EXECUÇÃO: técnico não pode prosseguir e registra a espera na OS. */
export async function marcarAguardandoAction(
  _prev: AcaoState,
  form: FormData,
): Promise<AcaoState> {
  try {
    await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados" };
  }
  const osId = String(form.get("osId") ?? "");
  if (!osId) return { erro: "OS não informada" };
  await db
    .update(ordemServico)
    .set({
      metadados: sql`${ordemServico.metadados} || ${JSON.stringify({
        aguardandoComplementar: true,
      })}::jsonb`,
    })
    .where(eq(ordemServico.id, osId));
  return { ok: true };
}
