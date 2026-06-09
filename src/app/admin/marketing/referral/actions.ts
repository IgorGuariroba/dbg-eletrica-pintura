"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { configReferral } from "@/db/schema";
import { exigirMarketing } from "../guard";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

export async function salvarConfigReferralAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirMarketing();

  const ativo = form.get("ativo") === "true";
  const valorPremio = String(form.get("valorPremio") ?? "30.00");

  if (isNaN(Number(valorPremio)) || Number(valorPremio) < 0) {
    return { erro: "O valor do prêmio deve ser um número positivo" };
  }

  try {
    await db
      .insert(configReferral)
      .values({
        id: "default",
        ativo,
        valorPremio,
      })
      .onConflictDoUpdate({
        target: configReferral.id,
        set: {
          ativo,
          valorPremio,
        },
      });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro desconhecido" };
  }

  revalidatePath("/admin/marketing/referral");
  return { ok: true };
}
