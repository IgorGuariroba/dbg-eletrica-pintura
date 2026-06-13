"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { criarConfigRemarketingRepoDrizzle } from "@/marketing/remarketing/config-repo";
import { exigirMarketing } from "../guard";
import type { GatilhoRemarketingId } from "@/marketing/remarketing/gatilhos";

export interface ActionState {
  erro?: string;
  ok?: boolean;
}

export async function salvarGatilhoAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  await exigirMarketing();

  const gatilho = String(form.get("gatilho") ?? "") as GatilhoRemarketingId;
  const ativo = form.get("ativo") === "true";
  
  const prazosDias: number[] = [];
  let idx = 0;
  while (form.has(`prazo_${idx}`)) {
    const rawVal = form.get(`prazo_${idx}`);
    if (rawVal !== null && rawVal !== "") {
      const val = Number(rawVal);
      if (Number.isInteger(val) && val >= 0) {
        prazosDias.push(val);
      }
    }
    idx++;
  }

  if (gatilho === "validade_orcamento" && (prazosDias.length === 0 || prazosDias[0] < 1)) {
    return { erro: "O prazo de validade do orçamento deve ser de pelo menos 1 dia" };
  }

  try {
    const repo = criarConfigRemarketingRepoDrizzle(db);
    const atual = await repo.obter(gatilho);
    await repo.salvar(gatilho, {
      ativo,
      prazosDias,
      templateId: atual.templateId,
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro desconhecido" };
  }

  revalidatePath("/admin/marketing/remarketing");
  return { ok: true };
}
