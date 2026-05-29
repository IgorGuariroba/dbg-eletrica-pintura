"use server";

import { redirect } from "next/navigation";
import { buscarCep } from "@/operacao/cep";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import { uploadServiceSolicitacaoR2 } from "@/operacao/r2-privado";
import { db } from "@/db/client";
import { categoriaServicoEnum } from "@/db/schema";
import type { Categoria } from "@/operacao/solicitacao-repo";

export interface SolicitarState {
  erro?: string;
}

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

export async function buscarCepAction(cep: string) {
  return buscarCep(cep);
}

export async function assinarUploadFotoSolicitacaoAction(input: {
  filename: string;
  contentType: string;
}) {
  return uploadServiceSolicitacaoR2().assinarUploadFoto(input);
}

export async function criarSolicitacaoAction(
  _prev: SolicitarState,
  form: FormData,
): Promise<SolicitarState> {
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
    resultado = await criarSolicitacao(
      {
        cliente: {
          nome: String(form.get("nome") ?? "").trim(),
          whatsapp: String(form.get("whatsapp") ?? "").trim(),
        },
        solicitacao: {
          categorias,
          descricao: String(form.get("descricao") ?? "").trim() || null,
          fotosUrls: fotosKeys,
          endereco: lerEndereco(form),
          dataDesejada,
          duracaoEstimada:
            String(form.get("duracaoEstimada") ?? "").trim() || null,
          lgpdAceito: form.get("lgpdAceito") === "true",
          origem: "FORMULARIO",
        },
      },
      criarSolicitacaoRepoDrizzle(db),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }

  redirect(`/s/${resultado.solicitacao.token}/confirmacao`);
}
