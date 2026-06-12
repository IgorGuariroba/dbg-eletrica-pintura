"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarServico } from "@/catalogo/criar-servico";
import { atualizarServico } from "@/catalogo/atualizar-servico";
import { toggleAtivoServico } from "@/catalogo/toggle-ativo-servico";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { uploadServicePublicoR2 } from "@/lib/storage";
import { db } from "@/db/client";
import { exigirCatalogo } from "./guard";

function repo() {
  return criarServicoRepoDrizzle(db);
}

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

function ler(form: FormData) {
  const fotoUrlBruto = String(form.get("fotoUrl") ?? "").trim();
  return {
    nome: String(form.get("nome") ?? "").trim(),
    categoria: String(form.get("categoria") ?? "") as
      | "ELETRICA"
      | "PINTURA"
      | "DRYWALL",
    precoBase: String(form.get("precoBase") ?? "").trim(),
    unidade: String(form.get("unidade") ?? "") as "PONTO" | "M2" | "HORA",
    prazoGarantiaMeses: Number(form.get("prazoGarantiaMeses") ?? 0),
    fotoUrl: fotoUrlBruto === "" ? null : fotoUrlBruto,
    ativo: form.get("ativo") === "on" || form.get("ativo") === "true",
  };
}

export async function criarServicoAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirCatalogo();
  try {
    await criarServico(ler(form), repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
  redirect("/admin/catalogo");
}

export async function atualizarServicoAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirCatalogo();
  try {
    await atualizarServico(id, ler(form), repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
  redirect("/admin/catalogo");
}

export async function toggleAtivoAction(id: string) {
  await exigirCatalogo();
  await toggleAtivoServico(id, repo());
  revalidatePath("/admin/catalogo");
  revalidatePath("/");
}

export async function assinarUploadFotoAction(input: {
  filename: string;
  contentType: string;
}) {
  await exigirCatalogo();
  const svc = uploadServicePublicoR2();
  return svc.assinarUploadFoto(input);
}
