"use server";

import { db } from "@/db/client";
import { exigirTecnico } from "@/app/campo/guard";
import { montarCobrancaCampo } from "@/pagamento/montar-cobranca";
import { registrarPagamentoManual } from "@/pagamento/registrar-manual";
import { criarPagamentoRepoDrizzle } from "@/pagamento/pagamento-repo-drizzle";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";
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
    const res = await montarCobrancaCampo(osId, "pix");
    if (!res.ok) return { erro: res.erro };
    return { ok: true, qrBase64: res.pix?.qrBase64, copiaCola: res.pix?.copiaCola };
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
    const res = await montarCobrancaCampo(osId, "link");
    if (!res.ok) return { erro: res.erro };

    const msg = `Olá! Segue o link para pagamento da Ordem de Serviço de ${res.link!.categoria.toLowerCase()}: ${res.link!.url}`;
    return { ok: true, urlWaMe: urlWhatsApp(msg) };
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
