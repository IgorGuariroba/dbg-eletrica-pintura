"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { db } from "@/db/client";
import { criarPlano } from "@/financeiro/planos/criar-plano";
import { atualizarPlano } from "@/financeiro/planos/atualizar-plano";
import { toggleAtivoPlano } from "@/financeiro/planos/toggle-ativo-plano";
import { publicarPlano } from "@/financeiro/planos/publicar-plano";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { criarGatewayMercadoPagoPlano } from "@/financeiro/planos/mercadopago-plano";
import { exigirFinanceiro } from "../guard";

function repo() {
  return criarPlanoRepoDrizzle(db);
}

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

function ler(form: FormData) {
  const beneficiosBruto = String(form.get("beneficios") ?? "").trim();
  return {
    nome: String(form.get("nome") ?? "").trim(),
    preco: String(form.get("preco") ?? "").trim(),
    beneficios: beneficiosBruto === "" ? null : beneficiosBruto,
    percentualDesconto: String(form.get("percentualDesconto") ?? "0").trim(),
    preventivasPorAno: Number(form.get("preventivasPorAno") ?? 0),
    prioridadeAgendamento:
      form.get("prioridadeAgendamento") === "on" ||
      form.get("prioridadeAgendamento") === "true",
    ativo: form.get("ativo") === "on" || form.get("ativo") === "true",
  };
}

export async function criarPlanoAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirFinanceiro();
  try {
    await criarPlano(ler(form), repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/financeiro/planos");
  revalidatePath("/planos");
  redirect("/admin/financeiro/planos" as Route);
}

export async function atualizarPlanoAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirFinanceiro();
  try {
    await atualizarPlano(id, ler(form), repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/financeiro/planos");
  revalidatePath("/planos");
  redirect("/admin/financeiro/planos" as Route);
}

export async function toggleAtivoPlanoAction(id: string) {
  await exigirFinanceiro();
  await toggleAtivoPlano(id, repo());
  revalidatePath("/admin/financeiro/planos");
  revalidatePath("/planos");
}

export async function publicarPlanoAction(id: string): Promise<ActionState> {
  await exigirFinanceiro();
  try {
    await publicarPlano(id, {
      repo: repo(),
      gateway: criarGatewayMercadoPagoPlano(),
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/financeiro/planos");
  return { ok: true };
}
