"use server";

import { db } from "@/db/client";
import { exigirTecnico } from "../guard";
import { agendaDoTecnico } from "@/operacao/agenda-tecnico";

export async function carregarAgendaAction() {
  const tec = await exigirTecnico();
  return agendaDoTecnico(db, tec.membroId, new Date());
}
