import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import type { Membro } from "@/equipe/membro-repo";
import type { UsuarioFila } from "@/operacao/fila";

export interface ContextoFila {
  usuario: UsuarioFila;
  membro: Membro | null;
  nome: string | null;
}

/**
 * Resolve o usuário logado em UsuarioFila. Admin raiz não tem registro em
 * `membro` — vê a fila inteira mas não consegue se auto-atribuir (sem id FK).
 */
export async function exigirFila(): Promise<ContextoFila> {
  const session = await auth();
  const user = session?.user;
  if (!user || user.role === "cliente") redirect("/");

  const membro = user.email
    ? await criarMembroRepoDrizzle(db).buscarPorEmail(user.email)
    : null;

  const usuario: UsuarioFila = {
    membroId: membro?.id ?? "",
    role: user.role,
    modulos: user.modulos,
    isTecnico: user.isTecnico,
    especialidades: membro?.especialidades ?? [],
  };
  return { usuario, membro, nome: user.name ?? user.email ?? null };
}
