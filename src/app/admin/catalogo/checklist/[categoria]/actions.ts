"use server";

import { revalidatePath } from "next/cache";
import {
  atualizarChecklistItem,
  criarChecklistItem,
  removerChecklistItem,
} from "@/catalogo/checklist-item";
import { criarChecklistItemRepoDrizzle } from "@/catalogo/checklist-repo-drizzle";
import type { Categoria } from "@/catalogo/checklist-repo";
import { db } from "@/db/client";
import { categoriaServicoEnum } from "@/db/schema";
import { exigirCatalogo } from "../../guard";

function repo() {
  return criarChecklistItemRepoDrizzle(db);
}

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

function validarCategoria(c: string): Categoria {
  if (!categoriaServicoEnum.enumValues.includes(c as Categoria)) {
    throw new Error("categoria inválida");
  }
  return c as Categoria;
}

function revalidar(categoria: Categoria) {
  revalidatePath(`/admin/catalogo/checklist/${categoria}`);
}

export async function criarItemAction(
  categoria: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirCatalogo();
  const cat = validarCategoria(categoria);
  try {
    await criarChecklistItem(
      {
        categoria: cat,
        ordem: Number(form.get("ordem") ?? 0),
        descricao: String(form.get("descricao") ?? ""),
        exigeFoto: form.get("exigeFoto") === "on" || form.get("exigeFoto") === "true",
      },
      repo(),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidar(cat);
  return { ok: true };
}

export async function atualizarItemAction(
  id: string,
  categoria: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirCatalogo();
  const cat = validarCategoria(categoria);
  try {
    await atualizarChecklistItem(
      id,
      {
        ordem: Number(form.get("ordem") ?? 0),
        descricao: String(form.get("descricao") ?? ""),
        exigeFoto: form.get("exigeFoto") === "on" || form.get("exigeFoto") === "true",
      },
      repo(),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidar(cat);
  return { ok: true };
}

export async function removerItemAction(id: string, categoria: string) {
  await exigirCatalogo();
  const cat = validarCategoria(categoria);
  await removerChecklistItem(id, repo());
  revalidar(cat);
}
