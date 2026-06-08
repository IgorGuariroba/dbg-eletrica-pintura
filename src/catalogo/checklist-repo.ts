import type { categoriaServicoEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];

export interface NovoChecklistItem {
  categoria: Categoria;
  ordem: number;
  descricao: string;
  exigeFoto: boolean;
}

export interface ChecklistItem extends NovoChecklistItem {
  id: string;
  ativo: boolean;
  criadoEm: Date;
}

export interface AtualizacaoChecklistItem {
  ordem?: number;
  descricao?: string;
  exigeFoto?: boolean;
  ativo?: boolean;
}

export interface ChecklistItemRepo {
  inserir(novo: NovoChecklistItem): Promise<ChecklistItem>;
  atualizar(
    id: string,
    mudancas: AtualizacaoChecklistItem,
  ): Promise<ChecklistItem | null>;
  remover(id: string): Promise<boolean>;
  buscarPorId(id: string): Promise<ChecklistItem | null>;
  listarPorCategoria(categoria: Categoria): Promise<ChecklistItem[]>;
}
