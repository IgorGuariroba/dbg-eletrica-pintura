"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { criarAssinaturaRepoDrizzle } from "@/assinatura/assinatura-repo-drizzle";
import {
  cancelarAssinatura,
  MotivoCancelamentoObrigatorioError,
} from "@/assinatura/cancelar-assinatura";
import { cancelarPreventivasFuturas } from "@/assinatura/cancelar-preventivas-futuras";
import { agendarDowngrade } from "@/assinatura/agendar-downgrade";
import { carregarGestaoAssinatura } from "@/assinatura/gestao-assinatura-loader";
import { criarGatewayMercadoPagoAssinatura } from "@/lib/mercadopago";
import { criarPreventivaRepoDrizzle } from "@/assinatura/preventiva-repo-drizzle";
import { upgradeAssinatura } from "@/assinatura/upgrade-assinatura";
import { criarGatewayMercadoPago } from "@/lib/mercadopago";
import { exigirPortal } from "@/portal/guard";

/** Resolve a assinatura gerenciável do cliente logado (garante posse). */
async function assinaturaDoCliente(whatsapp: string) {
  const gestao = await carregarGestaoAssinatura(whatsapp, db);
  if (!gestao) throw new Error("Nenhuma assinatura encontrada");
  return gestao;
}

export async function cancelarAssinaturaAction(
  motivo: string,
): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const gestao = await assinaturaDoCliente(user.whatsapp!);

    await cancelarAssinatura(
      { preapprovalIdMp: gestao.preapprovalIdMp, motivo },
      {
        gateway: criarGatewayMercadoPagoAssinatura(),
        repo: criarAssinaturaRepoDrizzle(db),
        cancelarPreventivas: async (assinaturaId, fimCiclo) => {
          await cancelarPreventivasFuturas(
            assinaturaId,
            fimCiclo,
            criarPreventivaRepoDrizzle(db),
          );
        },
      },
    );

    revalidatePath("/portal/assinatura");
    return {};
  } catch (err) {
    if (err instanceof MotivoCancelamentoObrigatorioError) {
      return { erro: "Informe o motivo do cancelamento." };
    }
    console.error("Erro ao cancelar assinatura (portal):", err);
    return { erro: err instanceof Error ? err.message : "Erro ao cancelar" };
  }
}

export async function agendarDowngradeAction(
  planoDestinoId: string,
): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const gestao = await assinaturaDoCliente(user.whatsapp!);
    const destino = gestao.opcoesDowngrade.find((p) => p.id === planoDestinoId);
    if (!destino) return { erro: "Plano de downgrade inválido." };

    await agendarDowngrade(
      {
        preapprovalIdMp: gestao.preapprovalIdMp,
        planoAtualPreco: Number(gestao.plano.preco),
        planoDestino: { id: destino.id, preco: Number(destino.preco) },
      },
      { repo: criarAssinaturaRepoDrizzle(db) },
    );

    revalidatePath("/portal/assinatura");
    return {};
  } catch (err) {
    console.error("Erro ao agendar downgrade (portal):", err);
    return { erro: err instanceof Error ? err.message : "Erro ao agendar" };
  }
}

export async function upgradeAssinaturaAction(
  planoDestinoId: string,
): Promise<{ erro?: string; pixCopiaECola?: string; valor?: number }> {
  try {
    const user = await exigirPortal();
    const gestao = await assinaturaDoCliente(user.whatsapp!);
    const destino = gestao.opcoesUpgrade.find((p) => p.id === planoDestinoId);
    if (!destino) return { erro: "Plano de upgrade inválido." };

    const pagamento = criarGatewayMercadoPago();
    const resultado = await upgradeAssinatura(
      {
        preapprovalIdMp: gestao.preapprovalIdMp,
        planoAtualPreco: Number(gestao.plano.preco),
        planoDestino: { id: destino.id, preco: Number(destino.preco) },
      },
      {
        repo: criarAssinaturaRepoDrizzle(db),
        gatewayAssinatura: criarGatewayMercadoPagoAssinatura(),
        cobrarDiferenca: async (input) => {
          const pix = await pagamento.criarPagamentoPix({
            transaction_amount: input.valor,
            description: input.descricao,
            metadata: { tipo: "upgrade_assinatura", clienteId: input.clienteId },
          });
          return {
            pagamentoId: String(pix.id),
            qrCode: pix.point_of_interaction.transaction_data.qr_code,
          };
        },
      },
    );

    revalidatePath("/portal/assinatura");
    return {
      valor: resultado.diferencaCobrada,
      pixCopiaECola: resultado.pagamento?.qrCode,
    };
  } catch (err) {
    console.error("Erro ao fazer upgrade (portal):", err);
    return { erro: err instanceof Error ? err.message : "Erro no upgrade" };
  }
}
