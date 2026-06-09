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
  /** Desconto de plano congelado no ato (assinante ativo). Default "0". */
  descontoPlano?: string;
  /** Percentual do desconto aplicado. Default "0". */
  percentualDescontoPlano?: string;
  /** Já líquido do desconto de plano, se houver. */
  total: string;
  validoAte: Date;
  /** Desconto de indicação (referral) congelado no ato. Default "0". */
  descontoIndicacao?: string;
}

export interface OrcamentoRepo {
  /** Carrega a OS (estado/dono/categoria) ou null se não existe. */
  carregarOsParaOrcamento(osId: string): Promise<OsParaOrcamento | null>;
  /** Preços autoritativos dos serviços informados. */
  buscarPrecosServicos(ids: string[]): Promise<ServicoPreco[]>;
  /**
   * Percentual de desconto do plano do cliente da OS, **somente** se houver
   * assinatura ATIVA. Retorna "0" caso contrário. Opcional: repositórios que
   * não conhecem assinatura (ex.: testes legados) são tratados como "0".
   */
  buscarPercentualDescontoAssinante?(osId: string): Promise<string>;
  /**
   * Obtém o desconto de indicação disponível para o cliente da OS.
   * Retorna "0.00" se não aplicável.
   */
  buscarDescontoIndicacaoDisponivel?(osId: string): Promise<string>;
  /**
   * Obtém a validade configurada do orçamento em dias. Se não implementado,
   * utiliza o padrão do sistema (7 dias).
   */
  obterValidadeDias?(): Promise<number>;
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
