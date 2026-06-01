"use server";

import { redirect } from "next/navigation";
import { buscarCep } from "@/operacao/cep";
import { reverseGeocode } from "@/operacao/geo";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import { uploadServiceSolicitacaoR2 } from "@/operacao/r2-privado";
import { db } from "@/db/client";
import {
  lerCategoriasForm,
  lerDataDesejadaForm,
  lerEnderecoForm,
  lerFotosKeysForm,
} from "@/operacao/solicitacao-form";
import { bairroForaDaCobertura } from "@/operacao/cobertura";
import { listarBairrosAtendidos } from "@/operacao/cobertura-query";

export interface SolicitarState {
  erro?: string;
}

export async function buscarCepAction(cep: string) {
  return buscarCep(cep);
}

export async function geocodeReversoAction(lat: number, lng: number) {
  return reverseGeocode(lat, lng);
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
  const categorias = lerCategoriasForm(form);
  const fotosKeys = lerFotosKeysForm(form);
  const dataDesejada = lerDataDesejadaForm(form);

  let resultado;
  try {
    const endereco = lerEnderecoForm(form);
    const bairrosAtendidos = await listarBairrosAtendidos();
    const foraCobertura = bairroForaDaCobertura(endereco.bairro, bairrosAtendidos);

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
          endereco,
          dataDesejada,
          duracaoEstimada:
            String(form.get("duracaoEstimada") ?? "").trim() || null,
          lgpdAceito: form.get("lgpdAceito") === "true",
          origem: "FORMULARIO",
          foraCobertura,
        },
      },
      criarSolicitacaoRepoDrizzle(db),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }

  redirect(`/s/${resultado.solicitacao.token}/confirmacao`);
}
