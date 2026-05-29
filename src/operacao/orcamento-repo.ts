import type { categoriaServicoEnum, estadoOsEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];
export type EstadoOs = (typeof estadoOsEnum.enumValues)[number];

/** OS reduzida ao necessário para montar/validar um orçamento. */
export interface OsParaOrcamento {
  id: string;
  estado: EstadoOs;
  tecnicoId: string | null;
  categoria: Categoria;
}

/** Preço autoritativo do serviço, lido do Catálogo (cliente não dita preço). */
export interface ServicoPreco {
  id: string;
  categoria: Categoria;
  precoBase: string;
  ativo: boolean;
}

export interface ItemPersistir {
  servicoId: string;
  quantidade: string;
  precoUnitario: string;
  subtotal: string;
}

export interface NovoOrcamento {
  osId: string;
  tecnicoId: string;
  itens: ItemPersistir[];
  totalMaoDeObra: string;
  totalDeslocamento: string;
  total: string;
  validoAte: Date;
}

export interface OrcamentoRepo {
  /** Carrega a OS (estado/dono/categoria) ou null se não existe. */
  carregarOsParaOrcamento(osId: string): Promise<OsParaOrcamento | null>;
  /** Preços autoritativos dos serviços informados. */
  buscarPrecosServicos(ids: string[]): Promise<ServicoPreco[]>;
  /**
   * Persiste orçamento + itens e transita a OS NOVA → ORÇADA de forma atômica
   * (só vence se a OS ainda está NOVA e atribuída ao técnico). Retorna o id do
   * orçamento criado ou null se a OS já não estava disponível.
   */
  criarParaOs(dados: NovoOrcamento): Promise<{ id: string } | null>;
}

export class NaoTecnicoError extends Error {
  readonly status = 403;
  constructor() {
    super("Apenas técnicos podem montar orçamento");
    this.name = "NaoTecnicoError";
  }
}

export class NaoAtribuidoError extends Error {
  readonly status = 403;
  constructor() {
    super("Essa OS não está atribuída a você");
    this.name = "NaoAtribuidoError";
  }
}

export class OsIndisponivelError extends Error {
  readonly status = 409;
  constructor() {
    super("Essa OS não está mais disponível para orçamento");
    this.name = "OsIndisponivelError";
  }
}

export class EstadoInvalidoError extends Error {
  readonly status = 409;
  constructor() {
    super("Só dá pra orçar uma OS no estado NOVA");
    this.name = "EstadoInvalidoError";
  }
}

export class ItensObrigatorioError extends Error {
  readonly status = 422;
  constructor() {
    super("Informe ao menos um item no orçamento");
    this.name = "ItensObrigatorioError";
  }
}

export class ServicoInvalidoError extends Error {
  readonly status = 422;
  constructor(msg: string) {
    super(msg);
    this.name = "ServicoInvalidoError";
  }
}

export class OrcamentoInvalidoError extends Error {
  readonly status = 422;
  constructor(msg: string) {
    super(msg);
    this.name = "OrcamentoInvalidoError";
  }
}
