import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { orcamento, ordemServico } from "@/db/schema";
import { podeCobrar } from "@/operacao/estado-predicados";
import { criarGatewayMercadoPago } from "@/lib/mercadopago";
import {
  criarCobrancaPix,
  criarPreferenciaCheckoutPro,
  montarCheckoutConsolidado,
} from "./checkout";
import { criarPagamentoCheckoutRepoDrizzle } from "./checkout-query-repo";
import type { GatewayPagamento } from "./gateway";

export interface MontarCobrancaDeps {
  /** Gateway de pagamento (default: adapter MP real). */
  gateway?: GatewayPagamento;
}

export type CobrancaCampoResultado =
  | {
      ok: true;
      pix?: { qrBase64: string; copiaCola: string };
      link?: { url: string; categoria: string };
    }
  | { ok: false; erro: string };

/**
 * Caso de uso: montar a cobrança no local pelo técnico (Pagamento Flexível —
 * Pix QR ou link de Checkout Pro). Valida `podeCobrar` UMA vez, resolve o
 * total pelo orçamento aprovado (desconto de assinante já embutido na criação
 * do orçamento) e gera o meio de pagamento via gateway. Autenticação do
 * técnico permanece na action — é regra de acesso da rota.
 */
export async function montarCobrancaCampo(
  osId: string,
  meio: "pix" | "link",
  deps: MontarCobrancaDeps = {},
): Promise<CobrancaCampoResultado> {
  const [os] = await db
    .select({ estado: ordemServico.estado, categoria: ordemServico.categoria })
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);

  if (!os) return { ok: false, erro: "Ordem de serviço não encontrada" };
  if (!podeCobrar(os.estado)) {
    return {
      ok: false,
      erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas",
    };
  }

  const [orc] = await db
    .select({ total: orcamento.total })
    .from(orcamento)
    .where(and(eq(orcamento.osId, osId), isNotNull(orcamento.aprovadoEm)))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);
  if (!orc) {
    return {
      ok: false,
      erro: "Nenhum orçamento aprovado encontrado para esta Ordem de Serviço",
    };
  }

  const gateway = deps.gateway ?? criarGatewayMercadoPago();

  if (meio === "pix") {
    const out = await criarCobrancaPix(gateway, {
      valor: orc.total,
      descricao: `DBG Eletrica e Pintura — OS ${osId.slice(0, 8)}`,
      metadata: { os_id: osId },
    });
    return { ok: true, pix: { qrBase64: out.qrBase64, copiaCola: out.copiaCola } };
  }

  const out = await criarPreferenciaCheckoutPro(gateway, {
    items: [
      {
        titulo: `DBG Serviços — OS ${osId.slice(0, 8)}`,
        quantidade: 1,
        precoUnitario: orc.total,
      },
    ],
    metadata: { os_id: osId },
  });
  return { ok: true, link: { url: out.url, categoria: os.categoria } };
}

export type AlvoConsolidado =
  | { tipo: "os"; osId: string }
  | { tipo: "tudo" }
  /** Combo do upsell (#65): paga tudo + 1ª mensalidade do plano. */
  | { tipo: "combo"; planoSlug: string };

export interface CobrancaConsolidadaResultado {
  url?: string;
  erro?: string;
}

/**
 * Caso de uso: montar a cobrança do Checkout Consolidado do cliente (página
 * por token da Solicitação). Composição do valor num lugar só: total das OS
 * pagáveis (`podeCobrar` via consolidado), dedução do crédito de indicação
 * (piso de R$ 0,01 — MP não aceita item zerado) e, no combo, a 1ª mensalidade
 * do plano com a assinatura nascendo PENDENTE (webhook ativa ao aprovar).
 */
export async function montarCobrancaConsolidada(
  token: string,
  alvo: AlvoConsolidado,
  deps: MontarCobrancaDeps = {},
): Promise<CobrancaConsolidadaResultado> {
  const sol = await criarPagamentoCheckoutRepoDrizzle(db).carregarPorToken(token);
  if (!sol) return { erro: "Solicitação não encontrada" };

  const gateway = deps.gateway ?? criarGatewayMercadoPago();

  if (alvo.tipo === "os") {
    const os = sol.ordens.find((o) => o.osId === alvo.osId);
    if (!os) {
      return { erro: "Ordem de serviço não encontrada ou não pertence a esta solicitação" };
    }
    if (!podeCobrar(os.estado)) {
      return { erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" };
    }

    const { precoUnitario, creditoUtilizado } = deduzirCredito(
      Number(os.total),
      Number(sol.saldoCredito),
    );
    const { rotularCategoria } = await import("@/operacao/rotulo-estado");
    const result = await criarPreferenciaCheckoutPro(gateway, {
      items: [
        {
          titulo: `${rotularCategoria(os.categoria)} (Serviço DBG)`,
          quantidade: 1,
          precoUnitario: precoUnitario.toFixed(2),
        },
      ],
      metadata: {
        os_id: alvo.osId,
        ...metadataCredito(creditoUtilizado, sol.clienteId),
      },
    });
    return { url: result.url };
  }

  const consolidado = montarCheckoutConsolidado(sol.ordens);
  if (!consolidado.podePagarTudo) {
    return { erro: "Nenhuma ordem de serviço pendente de pagamento" };
  }

  if (alvo.tipo === "tudo") {
    const { precoUnitario, creditoUtilizado } = deduzirCredito(
      Number(consolidado.somaPagavel),
      Number(sol.saldoCredito),
    );
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
        ...metadataCredito(creditoUtilizado, sol.clienteId),
      },
    });
    return { url: result.url };
  }

  // Combo (#65): valida plano + não-assinante, cria a assinatura PENDENTE e
  // monta a preferência com 2 itens (consolidado + 1ª mensalidade).
  const { criarPlanoRepoDrizzle } = await import(
    "@/financeiro/planos/plano-repo-drizzle"
  );
  const plano = await criarPlanoRepoDrizzle(db).buscarPorSlug(alvo.planoSlug);
  if (!plano || !plano.ativo) return { erro: "Plano indisponível" };

  const { criarUpsellRepoDrizzle } = await import(
    "@/financeiro/upsell/upsell-repo-drizzle"
  );
  if (await criarUpsellRepoDrizzle(db).temAssinaturaAtiva(sol.clienteId)) {
    return { erro: "Você já é assinante de um plano DBG" };
  }

  const { criarAssinaturaCombinadaRepoDrizzle } = await import(
    "@/assinatura/assinatura-combinada-repo-drizzle"
  );
  const { id: assinaturaId } = await criarAssinaturaCombinadaRepoDrizzle(
    db,
  ).criarPendente({ clienteId: sol.clienteId, planoId: plano.id });

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
}

/** Dedução do crédito de indicação com piso de R$ 0,01 (MP exige valor > 0). */
function deduzirCredito(
  total: number,
  saldoCredito: number,
): { precoUnitario: number; creditoUtilizado: number } {
  if (saldoCredito <= 0) return { precoUnitario: total, creditoUtilizado: 0 };
  const precoUnitario = Math.max(0.01, total - saldoCredito);
  return { precoUnitario, creditoUtilizado: total - precoUnitario };
}

/** Metadata de crédito só quando houve dedução (webhook consome o crédito). */
function metadataCredito(
  creditoUtilizado: number,
  clienteId: string,
): Record<string, string> {
  return creditoUtilizado > 0
    ? { credito_utilizado: creditoUtilizado.toFixed(2), cliente_id: clienteId }
    : {};
}
