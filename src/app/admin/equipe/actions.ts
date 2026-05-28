"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { atualizarMembro } from "@/equipe/atualizar-membro";
import { criarMembro } from "@/equipe/criar-membro";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { toggleAtivoMembro } from "@/equipe/toggle-ativo-membro";
import { uploadServicePublicoR2 } from "@/catalogo/r2-client";
import { db } from "@/db/client";
import { moduloEnum, categoriaServicoEnum } from "@/db/schema";
import type {
  DiaSemana,
  DisponibilidadeSemanal,
  Modulo,
  Categoria,
} from "@/equipe/membro-repo";
import { exigirEquipe } from "./guard";

function repo() {
  return criarMembroRepoDrizzle(db);
}

export interface ActionState {
  erro?: string;
}

const DIAS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function lerDisponibilidade(form: FormData): DisponibilidadeSemanal | null {
  const out: DisponibilidadeSemanal = {};
  let temAlgum = false;
  for (const d of DIAS) {
    const ativo = form.get(`disp_${d}_ativo`) === "on";
    if (!ativo) continue;
    const inicio = String(form.get(`disp_${d}_inicio`) ?? "").trim();
    const fim = String(form.get(`disp_${d}_fim`) ?? "").trim();
    if (!inicio || !fim) continue;
    out[d] = { inicio, fim };
    temAlgum = true;
  }
  return temAlgum ? out : null;
}

function lerMultiSelect<T extends string>(
  form: FormData,
  campo: string,
  validos: readonly T[],
): T[] {
  return form
    .getAll(campo)
    .map((v) => String(v))
    .filter((v): v is T => (validos as readonly string[]).includes(v));
}

function ler(form: FormData) {
  const modulos = lerMultiSelect<Modulo>(form, "modulos", moduloEnum.enumValues);
  const especialidades = lerMultiSelect<Categoria>(
    form,
    "especialidades",
    categoriaServicoEnum.enumValues,
  );
  const fotoUrlBruto = String(form.get("fotoUrl") ?? "").trim();
  const bioBruto = String(form.get("bio") ?? "").trim();
  return {
    nome: String(form.get("nome") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    modulos,
    isTecnico: form.get("isTecnico") === "true",
    fotoUrl: fotoUrlBruto || null,
    bio: bioBruto || null,
    especialidades,
    disponibilidade: lerDisponibilidade(form),
    ativo: form.get("ativo") !== "false",
  };
}

export async function criarMembroAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const session = await exigirEquipe();
  const dados = ler(form);
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (
    session.user.role !== "admin_raiz" &&
    adminEmail &&
    dados.email.toLowerCase() === adminEmail
  ) {
    return { erro: "e-mail reservado ao admin raiz" };
  }
  try {
    await criarMembro(dados, repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/equipe");
  redirect("/admin/equipe");
}

export async function atualizarMembroAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const session = await exigirEquipe();
  const alvo = await repo().buscarPorId(id);
  if (!alvo) return { erro: "membro não encontrado" };

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const editorEhAdminRaiz = session.user.role === "admin_raiz";
  const alvoEhAdminRaiz = adminEmail === alvo.email.toLowerCase();
  if (alvoEhAdminRaiz && !editorEhAdminRaiz) {
    return { erro: "apenas o admin raiz pode editar o próprio cadastro" };
  }

  const dados = ler(form);
  if (
    !editorEhAdminRaiz &&
    adminEmail &&
    dados.email.toLowerCase() === adminEmail
  ) {
    return { erro: "e-mail reservado ao admin raiz" };
  }

  try {
    await atualizarMembro(id, dados, repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/equipe");
  redirect("/admin/equipe");
}

export async function toggleAtivoMembroAction(id: string) {
  await exigirEquipe();
  await toggleAtivoMembro(id, repo());
  revalidatePath("/admin/equipe");
}

export async function assinarUploadFotoMembroAction(input: {
  filename: string;
  contentType: string;
}) {
  await exigirEquipe();
  return uploadServicePublicoR2("membros").assinarUploadFoto(input);
}
