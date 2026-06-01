"use server";

import { db } from "@/db/client";
import { criarPagamentoCheckoutRepoDrizzle } from "@/pagamento/checkout-query-repo-drizzle";
import { criarGatewayMercadoPago } from "@/pagamento/mercadopago-client";
import { criarPreferenciaCheckoutPro, montarCheckoutConsolidado } from "@/pagamento/checkout";
import { rotularCategoria } from "@/operacao/rotulo-estado";

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

  if (os.estado !== "CONCLUIDA") {
    return { erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" };
  }

  try {
    const gateway = criarGatewayMercadoPago();
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: `${rotularCategoria(os.categoria)} (Serviço DBG)`,
          quantidade: 1,
          precoUnitario: os.total,
        },
      ],
      metadata: { os_id: osId },
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
    const gateway = criarGatewayMercadoPago();
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: "Checkout Consolidado - DBG Elétrica e Pintura",
          quantidade: 1,
          precoUnitario: consolidado.somaPagavel,
        },
      ],
      metadata: { os_ids: consolidado.osIds },
    });

    return { url: result.url };
  } catch (e) {
    console.error("Erro ao gerar preferência consolidada:", e);
    return { erro: "Ocorreu um erro ao processar o seu pagamento. Tente novamente." };
  }
}
