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
import {
  exigirRateLimit,
  RateLimitExcedidoError,
} from "@/lib/rate-limit-guard";
import { verificarTurnstile } from "@/lib/turnstile";

export interface SolicitarState {
  erro?: string;
}

const MINUTO = 60_000;

export async function buscarCepAction(cep: string) {
  await exigirRateLimit("cep", { limite: 10, janelaMs: MINUTO });
  return buscarCep(cep);
}

export async function geocodeReversoAction(lat: number, lng: number) {
  await exigirRateLimit("geo", { limite: 10, janelaMs: MINUTO });
  return reverseGeocode(lat, lng);
}

export async function assinarUploadFotoSolicitacaoAction(input: {
  filename: string;
  contentType: string;
  contentLength: number;
}) {
  await exigirRateLimit("upload-solicitacao", {
    limite: 20,
    janelaMs: 10 * MINUTO,
  });
  return uploadServiceSolicitacaoR2().assinarUploadFoto(input);
}

/** Rate-limit + captcha; devolve a mensagem de bloqueio ou null se passou. */
async function bloqueioAntiAbuso(form: FormData): Promise<string | null> {
  try {
    await exigirRateLimit("criar-solicitacao", {
      limite: 5,
      janelaMs: 60 * MINUTO,
    });
  } catch (e) {
    if (e instanceof RateLimitExcedidoError) return e.message;
    throw e;
  }

  const captcha = await verificarTurnstile(
    form.get("cf-turnstile-response") as string | null,
  );
  if (!captcha.valido) {
    return "Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.";
  }
  return null;
}

export async function criarSolicitacaoAction(
  _prev: SolicitarState,
  form: FormData,
): Promise<SolicitarState> {
  const bloqueio = await bloqueioAntiAbuso(form);
  if (bloqueio) return { erro: bloqueio };

  const categorias = lerCategoriasForm(form);
  const fotosKeys = lerFotosKeysForm(form);
  const dataDesejada = lerDataDesejadaForm(form);

  const indicadorId = form.get("indicadorId") ? String(form.get("indicadorId")).trim() : null;

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
        indicadorId,
      },
      criarSolicitacaoRepoDrizzle(db),
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "erro desconhecido" };
  }

  redirect(`/s/${resultado.solicitacao.token}/confirmacao`);
}
