import { z } from "zod";
import { categoriaServicoEnum } from "@/db/schema";
import type {
  AtualizacaoChecklistItem,
  ChecklistItem,
  ChecklistItemRepo,
  NovoChecklistItem,
} from "./checklist-repo";

export const descricaoChecklistSchema = z
  .string()
  .trim()
  .min(1, "descrição obrigatória")
  .max(300, "descrição muito longa");

export const ordemChecklistSchema = z
  .number()
  .int()
  .min(0, "ordem não pode ser negativa");

export const novoChecklistItemSchema = z.object({
  categoria: z.enum(categoriaServicoEnum.enumValues),
  ordem: ordemChecklistSchema,
  descricao: descricaoChecklistSchema,
  exigeFoto: z.boolean().optional(),
});

export type CriarChecklistItemInput = z.input<typeof novoChecklistItemSchema>;

export async function criarChecklistItem(
  input: CriarChecklistItemInput,
  repo: ChecklistItemRepo,
): Promise<ChecklistItem> {
  const parsed = novoChecklistItemSchema.parse(input);
  const novo: NovoChecklistItem = {
    categoria: parsed.categoria,
    ordem: parsed.ordem,
    descricao: parsed.descricao,
    exigeFoto: parsed.exigeFoto ?? false,
  };
  return repo.inserir(novo);
}

export const atualizacaoChecklistItemSchema = z.object({
  ordem: ordemChecklistSchema.optional(),
  descricao: descricaoChecklistSchema.optional(),
  exigeFoto: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export async function atualizarChecklistItem(
  id: string,
  mudancas: AtualizacaoChecklistItem,
  repo: ChecklistItemRepo,
): Promise<ChecklistItem | null> {
  const parsed = atualizacaoChecklistItemSchema.parse(mudancas);
  return repo.atualizar(id, parsed);
}

export async function removerChecklistItem(
  id: string,
  repo: ChecklistItemRepo,
): Promise<boolean> {
  return repo.remover(id);
}
