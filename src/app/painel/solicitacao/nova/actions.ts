"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { categoriaServicoEnum } from "@/db/schema";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import {
  autorizarSolicitacaoManual,
  montarSolicitacaoManual,
} from "@/operacao/solicitacao-manual";
import type { Categoria } from "@/operacao/solicitacao-repo";
import type { SolicitarState } from "@/app/solicitar/actions";

function lerEndereco(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const num = (k: string) => {
    const v = form.get(k);
    return v ? Number(v) : undefined;
  };
  return {
    logradouro: get("end_logradouro"),
    numero: get("end_numero") || undefined,
    complemento: get("end_complemento") || undefined,
    bairro: get("end_bairro") || undefined,
    cidade: get("end_cidade"),
    uf: get("end_uf").toUpperCase(),
    cep: get("end_cep") || undefined,
    lat: num("end_lat"),
    lng: num("end_lng"),
  };
}

export async function criarSolicitacaoManualAction(
  _prev: SolicitarState,
  form: FormData,
): Promise<SolicitarState> {
  const session = await auth();

  let operadorEmail: string;
  try {
    operadorEmail = autorizarSolicitacaoManual(session?.user ?? null);
  } catch {
    return { erro: "Acesso negado: requer módulo Operação." };
  }

  const categorias = form
    .getAll("categorias")
    .map((v) => String(v))
    .filter((v): v is Categoria =>
      categoriaServicoEnum.enumValues.includes(v as Categoria),
    );

  const fotosKeys = form
    .getAll("fotosKeys")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const dataRaw = String(form.get("dataDesejada") ?? "").trim();
  const dataDesejada = dataRaw ? new Date(dataRaw) : null;

  let resultado;
  try {
    const input = montarSolicitacaoManual(
      {
        cliente: {
          nome: String(form.get("nome") ?? "").trim(),
          whatsapp: String(form.get("whatsapp") ?? "").trim(),
        },
        categorias,
        descricao: String(form.get("descricao") ?? "").trim() || null,
        fotosUrls: fotosKeys,
        endereco: lerEndereco(form),
        dataDesejada,
        duracaoEstimada: String(form.get("duracaoEstimada") ?? "").trim() || null,
        consentimentoConfirmado: form.get("lgpdAceito") === "true",
      },
      operadorEmail,
    );
    resultado = await criarSolicitacao(input, criarSolicitacaoRepoDrizzle(db));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }

  redirect(`/s/${resultado.solicitacao.token}/confirmacao`);
}
