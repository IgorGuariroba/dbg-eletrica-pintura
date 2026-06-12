"use server";

import { db } from "@/db/client";
import { criarPagamentoCheckoutRepoDrizzle } from "@/pagamento/checkout-query-repo-drizzle";
import { criarGatewayMercadoPago } from "@/lib/mercadopago";
import { criarPreferenciaCheckoutPro, montarCheckoutConsolidado } from "@/pagamento/checkout";
import { rotularCategoria } from "@/operacao/rotulo-estado";
import { podeCobrar } from "@/operacao/estado-predicados";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { criarUpsellRepoDrizzle } from "@/financeiro/upsell/upsell-repo-drizzle";
import { criarAssinaturaCombinadaRepoDrizzle } from "@/assinatura/assinatura-combinada-repo-drizzle";

export async function pagarOsAction(token: string, osId: string) {
  const repo = criarPagamentoCheckoutRepoDrizzle(db);
  const sol = await repo.carregarPorToken(token);

  if (!sol) {
    return { erro: "Solicitação não encontrada" };
  }

  const os = sol.ordens.find((o) => o.osId === osId);
  if (!os) {
    return { erro: "Ordem de serviço não encontrada ou não pertence a esta solicitação" };
  }

  if (!podeCobrar(os.estado)) {
    return { erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" };
  }

  try {
    const totalOs = Number(os.total);
    const saldoCredito = Number(sol.saldoCredito);

    let precoUnitario = totalOs;
    let creditoUtilizado = 0;

    if (saldoCredito > 0) {
      precoUnitario = Math.max(0.01, totalOs - saldoCredito);
      creditoUtilizado = totalOs - precoUnitario;
    }

    const gateway = criarGatewayMercadoPago();
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: `${rotularCategoria(os.categoria)} (Serviço DBG)`,
          quantidade: 1,
          precoUnitario: precoUnitario.toFixed(2),
        },
      ],
      metadata: {
        os_id: osId,
        ...(creditoUtilizado > 0
          ? {
              credito_utilizado: creditoUtilizado.toFixed(2),
              cliente_id: sol.clienteId,
            }
          : {}),
      },
    });

    return { url: result.url };
  } catch (e) {
    console.error("Erro ao gerar preferência de pagamento:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}

export async function pagarTudoAction(token: string) {
  const repo = criarPagamentoCheckoutRepoDrizzle(db);
  const sol = await repo.carregarPorToken(token);

  if (!sol) {
    return { erro: "Solicitação não encontrada" };
  }

  const consolidado = montarCheckoutConsolidado(sol.ordens);
  if (!consolidado.podePagarTudo) {
    return { erro: "Nenhuma ordem de serviço pendente de pagamento" };
  }

  try {
    const totalConsolidado = Number(consolidado.somaPagavel);
    const saldoCredito = Number(sol.saldoCredito);

    let precoUnitario = totalConsolidado;
    let creditoUtilizado = 0;

    if (saldoCredito > 0) {
      precoUnitario = Math.max(0.01, totalConsolidado - saldoCredito);
      creditoUtilizado = totalConsolidado - precoUnitario;
    }

    const gateway = criarGatewayMercadoPago();
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: "Checkout Consolidado - DBG Elétrica e Pintura",
          quantidade: 1,
          precoUnitario: precoUnitario.toFixed(2),
        },
      ],
      metadata: {
        os_ids: consolidado.osIds,
        ...(creditoUtilizado > 0
          ? {
              credito_utilizado: creditoUtilizado.toFixed(2),
              cliente_id: sol.clienteId,
            }
          : {}),
      },
    });

    return { url: result.url };
  } catch (e) {
    console.error("Erro ao gerar preferência consolidada:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}

/**
 * Combo do upsell (issue #65): paga as OS pendentes e a 1ª mensalidade do
 * plano numa preferência única. A assinatura nasce PENDENTE sem pre-approval;
 * o webhook de pagamentos ativa OS + assinatura quando o MP aprovar.
 */
export async function pagarTudoComAssinaturaAction(
  token: string,
  planoSlug: string,
) {
  const repo = criarPagamentoCheckoutRepoDrizzle(db);
  const sol = await repo.carregarPorToken(token);

  if (!sol) {
    return { erro: "Solicitação não encontrada" };
  }

  const consolidado = montarCheckoutConsolidado(sol.ordens);
  if (!consolidado.podePagarTudo) {
    return { erro: "Nenhuma ordem de serviço pendente de pagamento" };
  }

  const plano = await criarPlanoRepoDrizzle(db).buscarPorSlug(planoSlug);
  if (!plano || !plano.ativo) {
    return { erro: "Plano indisponível" };
  }

  if (await criarUpsellRepoDrizzle(db).temAssinaturaAtiva(sol.clienteId)) {
    return { erro: "Você já é assinante de um plano DBG" };
  }

  try {
    const assinaturaRepo = criarAssinaturaCombinadaRepoDrizzle(db);
    const { id: assinaturaId } = await assinaturaRepo.criarPendente({
      clienteId: sol.clienteId,
      planoId: plano.id,
    });

    const gateway = criarGatewayMercadoPago();
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: "Checkout Consolidado - DBG Elétrica e Pintura",
          quantidade: 1,
          precoUnitario: consolidado.somaPagavel,
        },
        {
          titulo: `1ª mensalidade — Plano ${plano.nome}`,
          quantidade: 1,
          precoUnitario: plano.preco,
        },
      ],
      metadata: {
        os_ids: consolidado.osIds,
        assinatura_id: assinaturaId,
        cliente_id: sol.clienteId,
      },
    });

    return { url: result.url };
  } catch (e) {
    console.error("Erro ao gerar preferência combinada:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}
