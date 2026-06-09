import { z } from "zod";
import type { AtualizacaoPlano, Plano, PlanoRepo } from "./plano-repo";
import {
  categoriasPreventivaSchema,
  nomePlanoSchema,
  percentualDescontoSchema,
  precoPlanoSchema,
  preventivasPorAnoSchema,
} from "./validacao";

export const atualizacaoPlanoSchema = z.object({
  nome: nomePlanoSchema.optional(),
  preco: precoPlanoSchema.optional(),
  beneficios: z.string().trim().nullable().optional(),
  percentualDesconto: percentualDescontoSchema.optional(),
  preventivasPorAno: preventivasPorAnoSchema.optional(),
  categoriasPreventiva: categoriasPreventivaSchema.optional(),
  prioridadeAgendamento: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export async function atualizarPlano(
  id: string,
  input: z.input<typeof atualizacaoPlanoSchema>,
  repo: PlanoRepo,
): Promise<Plano | null> {
  const parsed: AtualizacaoPlano = atualizacaoPlanoSchema.parse(input);
  return repo.atualizar(id, parsed);
}
