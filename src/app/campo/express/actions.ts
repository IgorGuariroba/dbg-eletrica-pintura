"use server";

import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import { exigirTecnico } from "../guard";
import { categoriaServicoEnum } from "@/db/schema";
import type { Categoria } from "@/operacao/solicitacao-repo";

export interface ExpressState {
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

export async function criarSolicitacaoExpressAction(
  _prev: ExpressState,
  form: FormData,
): Promise<ExpressState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch (e) {
    return { erro: "Apenas técnicos autenticados podem realizar essa ação" };
  }

  const lgpd = form.get("lgpdAceito") === "true";
  if (!lgpd) {
    return { erro: "O aceite da LGPD pelo cliente é obrigatório" };
  }

  const nome = String(form.get("nome") ?? "").trim();
  const whatsapp = String(form.get("whatsapp") ?? "").trim();

  if (!nome) return { erro: "Nome do cliente é obrigatório" };
  if (!whatsapp || !/^\d{10,11}$/.test(whatsapp)) {
    return { erro: "WhatsApp válido do cliente é obrigatório (10 ou 11 dígitos)" };
  }

  const categorias = form
    .getAll("categorias")
    .map((v) => String(v))
    .filter((v): v is Categoria =>
      categoriaServicoEnum.enumValues.includes(v as Categoria),
    );

  if (categorias.length === 0) {
    return { erro: "Selecione pelo menos uma categoria de serviço" };
  }

  const endereco = lerEndereco(form);
  if (!endereco.logradouro) return { erro: "Rua do endereço é obrigatória" };
  if (!endereco.cidade) return { erro: "Cidade do endereço é obrigatória" };
  if (!endereco.uf || endereco.uf.length !== 2) {
    return { erro: "UF do endereço é obrigatória (2 letras)" };
  }

  const r = Math.random().toString(36).slice(2, 10);
  const token = `tok-exp-${r}`;

  let resultado;
  try {
    const repo = criarSolicitacaoRepoDrizzle(db);
    resultado = await repo.criarComOrdens({
      cliente: { nome, whatsapp },
      solicitacao: {
        token,
        categorias,
        descricao: "Criada via Solicitação Express pelo técnico no local",
        fotosUrls: [],
        endereco,
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "EXPRESS_TECNICO",
      },
      ordensCustom: {
        tipo: "EXPRESS",
        estado: "ORCADA",
        tecnicoId: tecnico.membroId,
      },
    });
  } catch (e: any) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar solicitação" };
  }

  const primeiraOs = resultado.ordens[0];
  if (!primeiraOs) {
    return { erro: "Nenhuma ordem de serviço foi criada" };
  }

  redirect(`/painel/os/${primeiraOs.id}/orcamento`);
}
