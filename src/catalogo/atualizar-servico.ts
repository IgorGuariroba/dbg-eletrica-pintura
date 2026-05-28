import { z } from "zod";
import { categoriaServicoEnum, unidadeMedidaEnum } from "@/db/schema";
import type {
  AtualizacaoServico,
  Servico,
  ServicoRepo,
} from "./servico-repo";
import { nomeServicoSchema, prazoGarantiaSchema, precoBaseSchema } from "./validacao";

export const atualizacaoServicoSchema = z.object({
  nome: nomeServicoSchema.optional(),
  categoria: z.enum(categoriaServicoEnum.enumValues).optional(),
  precoBase: precoBaseSchema.optional(),
  unidade: z.enum(unidadeMedidaEnum.enumValues).optional(),
  prazoGarantiaMeses: prazoGarantiaSchema.optional(),
  fotoUrl: z.string().url().nullable().optional(),
  ativo: z.boolean().optional(),
});

export async function atualizarServico(
  id: string,
  input: z.input<typeof atualizacaoServicoSchema>,
  repo: ServicoRepo,
): Promise<Servico | null> {
  const parsed: AtualizacaoServico = atualizacaoServicoSchema.parse(input);
  return repo.atualizar(id, parsed);
}
