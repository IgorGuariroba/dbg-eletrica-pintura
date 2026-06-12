"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico, orcamento } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { criarGatewayMercadoPago } from "@/lib/mercadopago";
import { criarCobrancaPix, criarPreferenciaCheckoutPro } from "@/pagamento/checkout";
import { registrarPagamentoManual } from "@/pagamento/registrar-manual";
import { criarPagamentoRepoDrizzle } from "@/pagamento/pagamento-repo-drizzle";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";
import { podeCobrar } from "@/operacao/estado-predicados";
import { urlWhatsApp } from "@/lib/contato";

export interface AcaoState {
  erro?: string;
  ok?: boolean;
  qrBase64?: string;
  copiaCola?: string;
  urlWaMe?: string;
}

export async function gerarPixAction(osId: string): Promise<AcaoState> {
  try {
    await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem gerar cobrança Pix" };
  }

  try {
    const [os] = await db
      .select({ estado: ordemServico.estado, categoria: ordemServico.categoria })
      .from(ordemServico)
      .where(eq(ordemServico.id, osId))
      .limit(1);

    if (!os) {
      return { erro: "Ordem de serviço não encontrada" };
    }
    if (!podeCobrar(os.estado)) {
      return { erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" };
    }

    const [orc] = await db
      .select({ total: orcamento.total })
      .from(orcamento)
      .where(and(eq(orcamento.osId, osId), isNotNull(orcamento.aprovadoEm)))
      .orderBy(desc(orcamento.criadoEm))
      .limit(1);

    if (!orc) {
      return { erro: "Nenhum orçamento aprovado encontrado para esta Ordem de Serviço" };
    }

    const gateway = criarGatewayMercadoPago();
    const out = await criarCobrancaPix(gateway, {
      valor: orc.total,
      descricao: `DBG Eletrica e Pintura — OS ${osId.slice(0, 8)}`,
      metadata: { os_id: osId },
    });

    return {
      ok: true,
      qrBase64: out.qrBase64,
      copiaCola: out.copiaCola,
    };
  } catch (e) {
    return {
      erro:
        e instanceof Error ? e.message : "Erro desconhecido ao gerar o Pix QR Code",
    };
  }
}

export async function gerarLinkAction(osId: string): Promise<AcaoState> {
  try {
    await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem gerar link de pagamento" };
  }

  try {
    const [os] = await db
      .select({ estado: ordemServico.estado, categoria: ordemServico.categoria })
      .from(ordemServico)
      .where(eq(ordemServico.id, osId))
      .limit(1);

    if (!os) {
      return { erro: "Ordem de serviço não encontrada" };
    }
    if (!podeCobrar(os.estado)) {
      return { erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas" };
    }

    const [orc] = await db
      .select({ total: orcamento.total })
      .from(orcamento)
      .where(and(eq(orcamento.osId, osId), isNotNull(orcamento.aprovadoEm)))
      .orderBy(desc(orcamento.criadoEm))
      .limit(1);

    if (!orc) {
      return { erro: "Nenhum orçamento aprovado encontrado para esta Ordem de Serviço" };
    }

    const gateway = criarGatewayMercadoPago();
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

    const msg = `Olá! Segue o link para pagamento da Ordem de Serviço de ${os.categoria.toLowerCase()}: ${out.url}`;
    const urlWaMe = urlWhatsApp(msg);

    return {
      ok: true,
      urlWaMe,
    };
  } catch (e) {
    return {
      erro:
        e instanceof Error
          ? e.message
          : "Erro desconhecido ao gerar o link de pagamento",
    };
  }
}

export async function registrarManualAction(
  _prev: AcaoState,
  form: FormData
): Promise<AcaoState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados" };
  }

  const osId = String(form.get("osId") ?? "");
  const valor = String(form.get("valor") ?? "");
  const metodo = String(form.get("metodo") ?? "");
  const observacao = String(form.get("observacao") ?? "").trim();

  if (!osId) return { erro: "OS não informada" };
  if (!valor) return { erro: "Valor não informado" };
  if (!metodo) return { erro: "Método de pagamento não informado" };

  // O ator do pagamento vai pro registro financeiro — exigir identidade real
  // em vez de gravar um e-mail falso.
  if (!tecnico.email) {
    return { erro: "Técnico sem e-mail cadastrado não pode registrar pagamento" };
  }

  const deps = {
    pagamentoRepo: criarPagamentoRepoDrizzle(db),
    transicaoRepo: criarTransicaoRepoDrizzle(db),
  };

  const res = await registrarPagamentoManual(
    osId,
    {
      valor,
      metodo,
      observacao: observacao || undefined,
      atorEmail: tecnico.email,
    },
    deps
  );

  if (!res.ok) {
    return { erro: res.erro };
  }

  return { ok: true };
}
