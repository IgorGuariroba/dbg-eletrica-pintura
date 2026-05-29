"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { aprovarOrcamento, rejeitarOrcamento } from "@/operacao/aprovacao";
import { criarAprovacaoRepoDrizzle } from "@/operacao/aprovacao-repo-drizzle";

function repo() {
  return criarAprovacaoRepoDrizzle(db);
}

async function ipDoCliente(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export async function aprovarOsAction(
  token: string,
  osId: string,
): Promise<void> {
  const ip = await ipDoCliente();
  await aprovarOrcamento(token, osId, { token, ip }, repo());
  revalidatePath(`/s/${token}`);
}

export async function rejeitarOsAction(
  token: string,
  osId: string,
  motivo: string,
): Promise<void> {
  await rejeitarOrcamento(token, osId, motivo, repo());
  revalidatePath(`/s/${token}`);
}
