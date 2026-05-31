"use server";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { iniciarVinculacao, confirmarVinculacao } from "@/cliente/vinculacao";
import { criarVinculacaoRepoDrizzle } from "@/cliente/vinculacao-repo-drizzle";
import {
  ClienteNaoEncontradoError,
  WhatsappJaVinculadoError,
  CodigoInvalidoError,
  VinculacaoExpiradaError,
} from "@/cliente/vinculacao-repo";

export async function iniciarVinculacaoAction(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "cliente" || !session.user.email) {
    return { erro: "Não autorizado." };
  }

  const whatsapp = formData.get("whatsapp") as string;
  if (!whatsapp) {
    return { erro: "O número de WhatsApp é obrigatório." };
  }

  const repo = criarVinculacaoRepoDrizzle(db);

  try {
    await iniciarVinculacao(
      { googleEmail: session.user.email, whatsapp },
      repo
    );
    return { sucesso: true, passo: 2, whatsapp };
  } catch (e) {
    if (e instanceof ClienteNaoEncontradoError) {
      return {
        erro: "WhatsApp não cadastrado. É necessário fazer pelo menos uma solicitação de serviço primeiro para poder vincular sua conta.",
      };
    }
    if (e instanceof WhatsappJaVinculadoError) {
      return {
        erro: "Este número de WhatsApp já está vinculado a outra conta do Google.",
      };
    }
    return { erro: "Erro ao iniciar vinculação: " + (e as Error).message };
  }
}

export async function confirmarVinculacaoAction(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "cliente" || !session.user.email) {
    return { erro: "Não autorizado." };
  }

  const codigo = formData.get("codigo") as string;
  if (!codigo) {
    return { erro: "O código de 6 dígitos é obrigatório." };
  }

  const repo = criarVinculacaoRepoDrizzle(db);

  try {
    await confirmarVinculacao(
      { googleEmail: session.user.email, codigo },
      repo
    );
    return { sucesso: true, concluido: true };
  } catch (e) {
    if (e instanceof CodigoInvalidoError) {
      return { erro: "Código de verificação inválido." };
    }
    if (e instanceof VinculacaoExpiradaError) {
      return { erro: "O código expirou. Por favor, solicite um novo código." };
    }
    if (e instanceof WhatsappJaVinculadoError) {
      return { erro: "Este WhatsApp já está vinculado a outra conta." };
    }
    return { erro: "Erro ao confirmar: " + (e as Error).message };
  }
}
