"use server";

import { revalidatePath } from "next/cache";
import { criarGatewayGBP } from "@/marketing/gbp/gbp-gateway";
import { exigirMarketing } from "../guard";

export interface ResponderState {
  erro?: string;
  ok?: boolean;
}

export async function responderAvaliacaoAction(
  _prev: ResponderState,
  form: FormData,
): Promise<ResponderState> {
  await exigirMarketing();

  const reviewId = String(form.get("reviewId") ?? "").trim();
  const texto = String(form.get("texto") ?? "").trim();

  if (!reviewId) {
    return { erro: "Avaliação inválida" };
  }
  if (texto.length < 2) {
    return { erro: "A resposta precisa ter ao menos 2 caracteres" };
  }

  try {
    await criarGatewayGBP().responderAvaliacao(reviewId, texto);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao responder" };
  }

  revalidatePath("/admin/marketing/reputacao");
  return { ok: true };
}
