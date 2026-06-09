import type { categoriaServicoEnum, unidadeMedidaEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];
export type Unidade = (typeof unidadeMedidaEnum.enumValues)[number];

export interface NovoServico {
  nome: string;
  categoria: Categoria;
  precoBase: string;
  unidade: Unidade;
  prazoGarantiaMeses: number;
  fotoUrl: string | null;
  ativo: boolean;
}

export interface Servico extends NovoServico {
  id: string;
  slug: string | null;
  criadoEm: Date;
}

export interface AtualizacaoServico {
  nome?: string;
  categoria?: Categoria;
  precoBase?: string;
  unidade?: Unidade;
  prazoGarantiaMeses?: number;
  fotoUrl?: string | null;
  ativo?: boolean;
}

export interface ListarFiltro {
  categoria?: Categoria;
  ativo?: boolean;
  limit: number;
  offset: number;
}

export interface ListarResultado {
  itens: Servico[];
  total: number;
}

export interface ServicoRepo {
  inserir(novo: NovoServico): Promise<Servico>;
  atualizar(id: string, mudancas: AtualizacaoServico): Promise<Servico | null>;
  toggleAtivo(id: string): Promise<Servico | null>;
  buscarPorId(id: string): Promise<Servico | null>;
  buscarPorSlug(slug: string): Promise<Servico | null>;
  listar(filtro: ListarFiltro): Promise<ListarResultado>;
}
