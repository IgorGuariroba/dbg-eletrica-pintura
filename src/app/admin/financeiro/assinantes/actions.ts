"use server";

import { revalidatePath } from "next/cache";
import { criarAssinaturaRepoDrizzle } from "@/assinatura/assinatura-repo-drizzle";
import { criarGatewayMercadoPagoAssinatura } from "@/assinatura/mercadopago-assinatura";
import { pausarAssinatura } from "@/assinatura/pausar-assinatura";
import { db } from "@/db/client";
import { exigirFinanceiro } from "../guard";

/** Pausa a cobrança recorrente de um assinante (admin Financeiro). */
export async function pausarAssinanteAction(
  preapprovalIdMp: string,
): Promise<{ erro?: string }> {
  try {
    await exigirFinanceiro();
    await pausarAssinatura(preapprovalIdMp, {
      gateway: criarGatewayMercadoPagoAssinatura(),
      repo: criarAssinaturaRepoDrizzle(db),
    });
    revalidatePath("/admin/financeiro/assinantes");
    return {};
  } catch (err) {
    console.error("Erro ao pausar assinatura (admin):", err);
    return { erro: err instanceof Error ? err.message : "Erro ao pausar" };
  }
}
