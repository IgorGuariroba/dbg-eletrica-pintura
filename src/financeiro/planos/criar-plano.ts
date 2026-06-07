import { z } from "zod";
import type { NovoPlano, Plano, PlanoRepo } from "./plano-repo";
import {
  nomePlanoSchema,
  percentualDescontoSchema,
  precoPlanoSchema,
  preventivasPorAnoSchema,
} from "./validacao";

export const novoPlanoSchema = z.object({
  nome: nomePlanoSchema,
  preco: precoPlanoSchema,
  beneficios: z.string().trim().nullish(),
  percentualDesconto: percentualDescontoSchema,
  preventivasPorAno: preventivasPorAnoSchema,
  prioridadeAgendamento: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export type CriarPlanoInput = z.input<typeof novoPlanoSchema>;

export async function criarPlano(
  input: CriarPlanoInput,
  repo: PlanoRepo,
): Promise<Plano> {
  const parsed = novoPlanoSchema.parse(input);
  const novo: NovoPlano = {
    nome: parsed.nome,
    preco: parsed.preco,
    beneficios: parsed.beneficios ?? null,
    percentualDesconto: parsed.percentualDesconto,
    preventivasPorAno: parsed.preventivasPorAno,
    prioridadeAgendamento: parsed.prioridadeAgendamento ?? false,
    ativo: parsed.ativo ?? true,
  };
  return repo.inserir(novo);
}
