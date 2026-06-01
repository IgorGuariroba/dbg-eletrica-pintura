"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import {
  autorizarSolicitacaoManual,
  montarSolicitacaoManual,
} from "@/operacao/solicitacao-manual";
import {
  lerCategoriasForm,
  lerDataDesejadaForm,
  lerEnderecoForm,
  lerFotosKeysForm,
} from "@/operacao/solicitacao-form";
import type { SolicitarState } from "@/app/solicitar/actions";

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

  const categorias = lerCategoriasForm(form);
  const fotosKeys = lerFotosKeysForm(form);
  const dataDesejada = lerDataDesejadaForm(form);

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
        endereco: lerEnderecoForm(form),
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
