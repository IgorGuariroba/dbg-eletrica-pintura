"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { exigirOperacao } from "../guard";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

function positivo(valor: string, rotulo: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${rotulo} deve ser um número maior que zero`);
  }
  return n.toFixed(2);
}

export async function salvarConfigAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirOperacao();
  try {
    const precoLitro = positivo(
      String(form.get("precoLitro") ?? "").trim(),
      "Preço do litro",
    );
    const kmPorLitro = positivo(
      String(form.get("kmPorLitro") ?? "").trim(),
      "Km por litro",
    );
    await criarOperacaoConfigRepoDrizzle(db).atualizar({
      precoLitro,
      kmPorLitro,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/operacao/config");
  return { ok: true };
}
