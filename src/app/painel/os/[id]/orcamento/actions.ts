"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { montarOrcamento } from "@/operacao/orcamento";
import { criarOrcamentoRepoDrizzle } from "@/operacao/orcamento-repo-drizzle";
import { NaoTecnicoError } from "@/operacao/orcamento-repo";
import { exigirFila } from "../../../guard";

export interface ItemInput {
  servicoId: string;
  quantidade: string;
}

export async function montarOrcamentoAction(payload: {
  osId: string;
  itens: ItemInput[];
  km: number;
  deslocamentoOverride?: string | null;
}): Promise<void> {
  const { usuario } = await exigirFila();
  // Técnico sem registro em `membro` (ex.: admin raiz) não orça.
  if (!usuario.membroId) throw new NaoTecnicoError();

  const config = await criarOperacaoConfigRepoDrizzle(db).obter();
  await montarOrcamento(
    payload,
    { membroId: usuario.membroId, isTecnico: usuario.isTecnico },
    config,
    criarOrcamentoRepoDrizzle(db),
  );
  revalidatePath("/painel/fila");
}
