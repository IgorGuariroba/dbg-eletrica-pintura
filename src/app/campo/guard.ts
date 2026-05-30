import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";

export interface ContextoTecnico {
  membroId: string;
  nome: string | null;
  email: string | null;
  especialidades: string[];
}

/**
 * Resolve o técnico logado. Quem não é técnico (cliente, admin sem registro
 * de membro, membro interno não-técnico) é mandado para fora do app de campo.
 */
export async function exigirTecnico(): Promise<ContextoTecnico> {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.isTecnico) redirect("/");

  const membro = user.email
    ? await criarMembroRepoDrizzle(db).buscarPorEmail(user.email)
    : null;
  if (!membro) redirect("/");

  return {
    membroId: membro.id,
    nome: user.name ?? user.email ?? null,
    email: user.email ?? null,
    especialidades: membro.especialidades ?? [],
  };
}
