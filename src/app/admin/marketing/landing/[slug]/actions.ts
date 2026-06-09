"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { exigirMarketing } from "../../guard";
import { criarLandingOverrideRepoDrizzle } from "@/marketing/landing/landing-override-repo-drizzle";
import { criarDepoimentosQueryDrizzle } from "@/marketing/landing/depoimentos-query-drizzle";
import { validarPrecoPromo } from "@/marketing/landing/validar-override";
import { uploadServicePublicoR2 } from "@/catalogo/r2-client";

interface Resultado {
  erro?: string;
}

// Revalida tanto a landing pública (ISR) quanto a tela de edição do admin.
function revalidarLanding(slug: string) {
  revalidatePath(`/servicos/${slug}`);
  revalidatePath(`/admin/marketing/landing/${slug}`);
}

export async function salvarOverrideAction(input: {
  servicoId: string;
  slug: string;
  precoBase: string;
  titulo: string | null;
  descricao: string | null;
  precoPromo: string | null;
  upsellServicoId: string | null;
}): Promise<Resultado> {
  await exigirMarketing();

  const erroPreco = validarPrecoPromo(input.precoBase, input.precoPromo);
  if (erroPreco) return { erro: erroPreco };

  try {
    const repo = criarLandingOverrideRepoDrizzle(db);
    const norm = (v: string | null) => {
      const t = v?.trim();
      return t ? t : null;
    };
    await repo.salvar(input.servicoId, {
      titulo: norm(input.titulo),
      descricao: norm(input.descricao),
      precoPromo: norm(input.precoPromo),
      upsellServicoId: input.upsellServicoId || null,
    });
    revalidarLanding(input.slug);
    return {};
  } catch (e) {
    return {
      erro: e instanceof Error ? e.message : "Erro ao salvar override",
    };
  }
}

export async function assinarUploadFotoLandingAction(input: {
  filename: string;
  contentType: string;
}) {
  await exigirMarketing();
  return uploadServicePublicoR2("landing").assinarUploadFoto(input);
}

export async function adicionarFotoAction(input: {
  servicoId: string;
  slug: string;
  chave: string;
}): Promise<Resultado> {
  await exigirMarketing();
  try {
    const repo = criarLandingOverrideRepoDrizzle(db);
    // Garante que o override existe antes de anexar foto (FK).
    if (!(await repo.obterPorServico(input.servicoId))) {
      await repo.salvar(input.servicoId, {});
    }
    await repo.adicionarFoto(input.servicoId, input.chave);
    revalidarLanding(input.slug);
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao adicionar foto" };
  }
}

export async function removerFotoAction(input: {
  fotoId: string;
  slug: string;
}): Promise<Resultado> {
  await exigirMarketing();
  try {
    await criarLandingOverrideRepoDrizzle(db).removerFoto(input.fotoId);
    revalidarLanding(input.slug);
    return {};
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao remover foto" };
  }
}

export async function definirDepoimentosAction(input: {
  servicoId: string;
  slug: string;
  avaliacaoIds: string[];
}): Promise<Resultado> {
  await exigirMarketing();
  try {
    const repo = criarLandingOverrideRepoDrizzle(db);
    if (!(await repo.obterPorServico(input.servicoId))) {
      await repo.salvar(input.servicoId, {});
    }
    // Filtra por candidatos qualificados (≥4★, não invalidados, com
    // comentário), preservando a ordem escolhida — descarta ids inválidos.
    const validos = (
      await criarDepoimentosQueryDrizzle(db).porIds(input.avaliacaoIds)
    ).map((c) => c.avaliacaoId);
    await repo.definirDepoimentos(input.servicoId, validos);
    revalidarLanding(input.slug);
    return {};
  } catch (e) {
    return {
      erro: e instanceof Error ? e.message : "Erro ao salvar depoimentos",
    };
  }
}
