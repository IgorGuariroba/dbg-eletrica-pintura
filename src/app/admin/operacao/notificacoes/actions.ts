"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { buscarTemplate, criarTemplateRepo } from "@/notificacao/templates";
import { exigirOperacao } from "../guard";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

/**
 * Salva os overrides de variáveis padrão de um template. Só as chaves do
 * catálogo são aceitas — a Operação edita valores (saudação, assinatura, link
 * base), nunca o corpo aprovado na Meta nem chaves arbitrárias.
 */
export async function salvarVariaveisTemplateAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirOperacao();

  const nome = String(form.get("nome") ?? "");
  const template = buscarTemplate(nome);
  if (!template) return { erro: "Template desconhecido" };

  const variaveis: Record<string, string> = {};
  for (const chave of Object.keys(template.variaveisPadrao)) {
    variaveis[chave] = String(form.get(`var_${chave}`) ?? "").trim();
  }

  try {
    await criarTemplateRepo(db).salvarVariaveis(nome, variaveis);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }

  revalidatePath("/admin/operacao/notificacoes");
  return { ok: true };
}
