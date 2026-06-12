"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { aprovarFoto, rejeitarFoto } from "@/marketing/portfolio";
import { criarPortfolioRepoDrizzle } from "@/marketing/portfolio-repo-drizzle";
import { copiadorR2 } from "@/lib/storage";
import { exigirMarketing } from "../guard";

export interface PortfolioActionState {
  erro?: string;
}

function repo() {
  return criarPortfolioRepoDrizzle(db);
}

export async function aprovarFotoAction(
  id: string,
  temDadoSensivel: boolean,
): Promise<PortfolioActionState> {
  const session = await exigirMarketing();
  try {
    await aprovarFoto(
      id,
      { decididoPor: session.user.email ?? "", temDadoSensivel },
      repo(),
      copiadorR2(),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/marketing/portfolio");
  return {};
}

export async function rejeitarFotoAction(
  id: string,
  motivo: string,
): Promise<PortfolioActionState> {
  const session = await exigirMarketing();
  try {
    await rejeitarFoto(id, { decididoPor: session.user.email ?? "", motivo }, repo());
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
  revalidatePath("/admin/marketing/portfolio");
  return {};
}
