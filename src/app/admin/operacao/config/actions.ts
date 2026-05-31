"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { podeAcessarModulo } from "@/auth/require-modulo";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { criarBairroCoberturaRepoDrizzle } from "@/operacao/cobertura-repo-drizzle";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import {
  atualizarDisponibilidadeTecnico,
  podeEditarDisponibilidade,
} from "@/operacao/disponibilidade-tecnico";
import {
  type DiaSemana,
  type HorarioComercial,
  validarHorarioComercial,
} from "@/operacao/horario-comercial";
import { exigirOperacao } from "../guard";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

const DIAS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function positivo(valor: string, rotulo: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${rotulo} deve ser um número maior que zero`);
  }
  return n.toFixed(2);
}

// Lê do FormData a grade semanal: dia marcado como aberto vira janela; os
// demais ficam `null` (fechado).
function lerHorarioComercial(form: FormData): HorarioComercial {
  const grade: HorarioComercial = {};
  for (const dia of DIAS) {
    if (form.get(`${dia}_aberto`) == null) {
      grade[dia] = null;
      continue;
    }
    grade[dia] = {
      inicio: String(form.get(`${dia}_inicio`) ?? ""),
      fim: String(form.get(`${dia}_fim`) ?? ""),
    };
  }
  return validarHorarioComercial(grade);
}

function lerDisponibilidade(form: FormData): HorarioComercial {
  const grade: HorarioComercial = {};
  for (const dia of DIAS) {
    if (form.get(`${dia}_aberto`) == null) continue;
    grade[dia] = {
      inicio: String(form.get(`${dia}_inicio`) ?? ""),
      fim: String(form.get(`${dia}_fim`) ?? ""),
    };
  }
  return grade;
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
    const repo = criarOperacaoConfigRepoDrizzle(db);
    const atual = await repo.obter();
    await repo.atualizar({ ...atual, precoLitro, kmPorLitro });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/operacao/config");
  return { ok: true };
}

export async function salvarHorarioComercialAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirOperacao();
  try {
    const horarioComercial = lerHorarioComercial(form);
    const repo = criarOperacaoConfigRepoDrizzle(db);
    const atual = await repo.obter();
    await repo.atualizar({ ...atual, horarioComercial });
  } catch {
    return {
      erro: "Horário inválido: confira abertura e fechamento de cada dia",
    };
  }
  revalidatePath("/admin/operacao/config");
  return { ok: true };
}

export async function adicionarBairroAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirOperacao();
  try {
    await criarBairroCoberturaRepoDrizzle(db).adicionar(
      String(form.get("nome") ?? ""),
    );
  } catch {
    return { erro: "Informe um nome de bairro válido" };
  }
  revalidatePath("/admin/operacao/config");
  return { ok: true };
}

export async function removerBairroAction(form: FormData): Promise<void> {
  await exigirOperacao();
  const id = String(form.get("id") ?? "");
  if (id) await criarBairroCoberturaRepoDrizzle(db).remover(id);
  revalidatePath("/admin/operacao/config");
}

export async function salvarDisponibilidadeTecnicoAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const session = await auth();
  const user = session?.user;
  const tecnicoId = String(form.get("tecnicoId") ?? "");
  if (!user || !tecnicoId) return { erro: "Sessão inválida" };

  // Resolve o id do membro logado para distinguir auto-edição de edição alheia.
  const eu = user.email
    ? await criarMembroRepoDrizzle(db).buscarPorEmail(user.email)
    : null;
  const ator = {
    id: eu?.id ?? "",
    podeGerenciarEquipe: podeAcessarModulo("EQUIPE", user),
  };
  if (!podeEditarDisponibilidade(ator, tecnicoId)) {
    return { erro: "Sem permissão para editar esta disponibilidade" };
  }

  try {
    await atualizarDisponibilidadeTecnico(
      { tecnicoId, disponibilidade: lerDisponibilidade(form) },
      {
        membroRepo: criarMembroRepoDrizzle(db),
        configRepo: criarOperacaoConfigRepoDrizzle(db),
      },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "DisponibilidadeForaDoComercialError") {
      return { erro: "Disponibilidade fora do horário comercial" };
    }
    return { erro: "Não foi possível salvar a disponibilidade" };
  }
  revalidatePath("/admin/operacao/config");
  revalidatePath("/campo/perfil");
  return { ok: true };
}
