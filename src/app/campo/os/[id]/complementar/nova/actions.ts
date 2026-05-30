"use server";

import { db } from "@/db/client";
import { exigirTecnico } from "@/app/campo/guard";
import { criarComplementar } from "@/operacao/complementar";
import { criarComplementarRepoDrizzle } from "@/operacao/complementar-repo-drizzle";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";

export interface ComplementarState {
  erro?: string;
  complementarId?: string;
}

export async function criarComplementarAction(
  _prev: ComplementarState,
  form: FormData,
): Promise<ComplementarState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem criar complementar" };
  }

  const osPaiId = String(form.get("osPaiId") ?? "");
  const km = Number(form.get("km") ?? "0") || 0;
  const overrideRaw = form.get("deslocamentoOverride");
  const deslocamentoOverride =
    overrideRaw != null && String(overrideRaw) !== "" ? String(overrideRaw) : null;

  // Itens chegam como pares servicoId/quantidade alinhados por índice.
  const servicoIds = form.getAll("servicoId").map(String);
  const quantidades = form.getAll("quantidade").map(String);
  const itens = servicoIds
    .map((servicoId, i) => ({ servicoId, quantidade: quantidades[i] ?? "0" }))
    .filter((i) => i.servicoId && Number(i.quantidade) > 0);

  try {
    const config = await criarOperacaoConfigRepoDrizzle(db).obter();
    const out = await criarComplementar(
      { osPaiId, itens, km, deslocamentoOverride },
      { membroId: tecnico.membroId, isTecnico: true },
      { precoLitro: config.precoLitro, kmPorLitro: config.kmPorLitro },
      criarComplementarRepoDrizzle(db),
    );
    return { complementarId: out.osId };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar complementar" };
  }
}
