import { z } from "zod";
import { categoriaServicoEnum, unidadeMedidaEnum } from "@/db/schema";
import type { NovoServico, Servico, ServicoRepo } from "./servico-repo";
import { nomeServicoSchema, prazoGarantiaSchema, precoBaseSchema } from "./validacao";

export const novoServicoSchema = z.object({
  nome: nomeServicoSchema,
  categoria: z.enum(categoriaServicoEnum.enumValues),
  precoBase: precoBaseSchema,
  unidade: z.enum(unidadeMedidaEnum.enumValues),
  prazoGarantiaMeses: prazoGarantiaSchema,
  fotoUrl: z.string().url().nullish(),
  ativo: z.boolean().optional(),
});

export type CriarServicoInput = z.input<typeof novoServicoSchema>;

export async function criarServico(
  input: CriarServicoInput,
  repo: ServicoRepo,
): Promise<Servico> {
  const parsed = novoServicoSchema.parse(input);
  const novo: NovoServico = {
    nome: parsed.nome,
    categoria: parsed.categoria,
    precoBase: parsed.precoBase,
    unidade: parsed.unidade,
    prazoGarantiaMeses: parsed.prazoGarantiaMeses,
    fotoUrl: parsed.fotoUrl ?? null,
    ativo: parsed.ativo ?? true,
  };
  return repo.inserir(novo);
}
