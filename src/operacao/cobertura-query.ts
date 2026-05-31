import { db } from "@/db/client";
import { criarBairroCoberturaRepoDrizzle } from "./cobertura-repo-drizzle";

/**
 * Lista pública dos bairros atendidos (apenas os nomes), consumida pelo
 * aviso de cobertura do formulário público (Fase 3, slice 4).
 */
export async function listarBairrosAtendidos(): Promise<string[]> {
  const bairros = await criarBairroCoberturaRepoDrizzle(db).listar();
  return bairros.map((b) => b.nome);
}
