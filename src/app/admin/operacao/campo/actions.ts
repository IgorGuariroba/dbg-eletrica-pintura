"use server";

import { db } from "@/db/client";
import { criarCampoRepoDrizzle } from "@/operacao/campo-repo-drizzle";
import { listarTecnicosEmCampo } from "@/operacao/campo";
import type { FiltroTecnicosEmCampo } from "@/operacao/campo-repo";
import { exigirOperacao } from "../guard";

/**
 * Server Action para o polling de 30s do client component.
 * Revalida a lista de técnicos em campo com filtros opcionais.
 */
export async function buscarTecnicosEmCampoAction(
  filtro?: FiltroTecnicosEmCampo,
) {
  await exigirOperacao();
  const repo = criarCampoRepoDrizzle(db);
  return listarTecnicosEmCampo(repo, filtro);
}
