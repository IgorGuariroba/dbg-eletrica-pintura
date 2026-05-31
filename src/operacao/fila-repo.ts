import type { categoriaServicoEnum, estadoOsEnum, tipoOsEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];
export type EstadoOs = (typeof estadoOsEnum.enumValues)[number];
export type TipoOs = (typeof tipoOsEnum.enumValues)[number];

/**
 * OS como aparece na fila. Inclui dados mínimos do cliente/endereço pra
 * o técnico decidir se pega — sem expor o orçamento.
 */
export interface OsFila {
  id: string;
  categoria: Categoria;
  tipo: TipoOs;
  estado: EstadoOs;
  tecnicoId: string | null;
  clienteNome: string;
  cidade: string;
  uf: string;
  foraCobertura: boolean;
  criadoEm: Date;
}

export interface ListarFilaFiltro {
  /** Limita às categorias informadas (interseção com especialidade do técnico). */
  categorias?: Categoria[];
  /** Quando true, restringe a OS NOVA na fila (visão do técnico). */
  apenasDisponiveis?: boolean;
  /**
   * Com apenasDisponiveis, inclui também as OS NOVA já atribuídas a este
   * técnico — para que ele consiga enxergar (e devolver) as que pegou.
   */
  incluirTecnicoId?: string;
  limit: number;
  offset: number;
}

export interface ListarFilaResultado {
  itens: OsFila[];
  total: number;
}

export interface FilaRepo {
  listar(filtro: ListarFilaFiltro): Promise<ListarFilaResultado>;
  buscarPorId(id: string): Promise<OsFila | null>;
  /**
   * Todas as OS atribuídas a um técnico (qualquer estado), mais antigas
   * primeiro. Base da lista "minhas OS" do app de campo.
   */
  listarPorTecnico(tecnicoId: string): Promise<OsFila[]>;
  /**
   * Self-assign atômico. Atualiza tecnico_id apenas se a OS ainda está NOVA e
   * sem técnico — vence a corrida quem persiste primeiro. Retorna a OS
   * atualizada ou null se já não estava disponível.
   */
  autoatribuir(osId: string, tecnicoId: string): Promise<OsFila | null>;
  /**
   * Devolve à fila uma OS NOVA atribuída ao próprio técnico. Limpa tecnico_id
   * e registra o motivo em metadados. Retorna a OS atualizada ou null se a OS
   * não está NOVA / não pertence ao técnico.
   */
  devolver(
    osId: string,
    tecnicoId: string,
    motivo: string,
  ): Promise<OsFila | null>;
}

export class NaoTecnicoError extends Error {
  readonly status = 403;
  constructor() {
    super("Apenas técnicos podem pegar ou devolver OS da fila");
    this.name = "NaoTecnicoError";
  }
}

export class OsIndisponivelError extends Error {
  readonly status = 409;
  constructor() {
    super("Essa OS já foi pega por outro técnico");
    this.name = "OsIndisponivelError";
  }
}

export class MotivoObrigatorioError extends Error {
  readonly status = 422;
  constructor() {
    super("Informe um motivo para devolver a OS");
    this.name = "MotivoObrigatorioError";
  }
}

export class DevolucaoInvalidaError extends Error {
  readonly status = 409;
  constructor() {
    super("Só dá pra devolver uma OS NOVA atribuída a você");
    this.name = "DevolucaoInvalidaError";
  }
}
