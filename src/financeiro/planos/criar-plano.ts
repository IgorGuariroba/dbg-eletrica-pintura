import { z } from "zod";
import type { NovoPlano, Plano, PlanoRepo } from "./plano-repo";
import {
  categoriasPreventivaSchema,
  nomePlanoSchema,
  percentualDescontoSchema,
  precoPlanoSchema,
  preventivasPorAnoSchema,
} from "./validacao";

/** Default de negócio: a DBG é "Elétrica e Pintura". */
const CATEGORIAS_PREVENTIVA_PADRAO = ["ELETRICA", "PINTURA"] as const;

export const novoPlanoSchema = z.object({
  nome: nomePlanoSchema,
  preco: precoPlanoSchema,
  beneficios: z.string().trim().nullish(),
  percentualDesconto: percentualDescontoSchema,
  preventivasPorAno: preventivasPorAnoSchema,
  categoriasPreventiva: categoriasPreventivaSchema.optional(),
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
    categoriasPreventiva:
      parsed.categoriasPreventiva ?? [...CATEGORIAS_PREVENTIVA_PADRAO],
    prioridadeAgendamento: parsed.prioridadeAgendamento ?? false,
    ativo: parsed.ativo ?? true,
  };
  return repo.inserir(novo);
}
