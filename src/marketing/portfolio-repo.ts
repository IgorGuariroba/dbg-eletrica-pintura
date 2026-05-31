import type { Categoria as CategoriaServico } from "@/catalogo/servico-repo";

export type StatusFotoPortfolio = "PENDENTE" | "APROVADA" | "REJEITADA";
export type TipoFoto = "ANTES" | "DEPOIS";

/** Foto de execução que o técnico marcou como candidata a portfólio. */
export interface FotoPortfolio {
  id: string;
  osId: string;
  tecnicoId: string | null;
  categoria: CategoriaServico;
  tipo: TipoFoto;
  chavePrivada: string;
  chavePublica: string | null;
  status: StatusFotoPortfolio;
  motivoRejeicao: string | null;
  temDadoSensivel: boolean;
  criadoEm: Date;
}

/** Item da fila de aprovação (admin Marketing): foto + contexto da OS. */
export interface FotoPortfolioPendente {
  id: string;
  osId: string;
  chavePrivada: string;
  categoria: CategoriaServico;
  tipo: TipoFoto;
  tecnicoNome: string | null;
  notaServico: string | null;
  criadoEm: Date;
}

/** Foto aprovada para exibição pública (landing, perfil do técnico). */
export interface FotoPublica {
  id: string;
  chavePublica: string;
  categoria: CategoriaServico;
  tipo: TipoFoto;
  tecnicoNome: string | null;
  criadoEm: Date;
}

export interface MarcarFotoInput {
  osId: string;
  tecnicoId: string | null;
  categoria: CategoriaServico;
  tipo: TipoFoto;
  chavePrivada: string;
}

export interface AprovarInput {
  chavePublica: string;
  decididoPor: string;
  temDadoSensivel: boolean;
}

export interface RejeitarInput {
  motivo: string | null;
  decididoPor: string;
}

export interface PortfolioRepo {
  /** Registra a foto como candidata PENDENTE. Idempotente por chavePrivada. */
  marcar(input: MarcarFotoInput): Promise<FotoPortfolio>;
  buscar(id: string): Promise<FotoPortfolio | null>;
  listarPendentes(): Promise<FotoPortfolioPendente[]>;
  /** Transita PENDENTE → APROVADA. `true` se de fato transitou. */
  aprovar(id: string, input: AprovarInput): Promise<boolean>;
  /** Transita PENDENTE → REJEITADA. `true` se de fato transitou. */
  rejeitar(id: string, input: RejeitarInput): Promise<boolean>;
  /** Últimas fotos APROVADAS, mais recentes primeiro. */
  listarPublicas(limite: number): Promise<FotoPublica[]>;
  /** Últimas fotos APROVADAS de um técnico, mais recentes primeiro. */
  listarPublicasPorTecnico(
    tecnicoId: string,
    limite: number,
  ): Promise<FotoPublica[]>;
}

/** Copia a foto do R2 privado para o R2 público (cópia separada). */
export interface CopiadorFotoPublica {
  copiar(chavePrivada: string): Promise<{ chavePublica: string }>;
}

export class FotoNaoEncontradaError extends Error {
  constructor() {
    super("Foto de portfólio não encontrada");
    this.name = "FotoNaoEncontradaError";
  }
}

export class FotoJaDecididaError extends Error {
  constructor() {
    super("Foto de portfólio já foi aprovada ou rejeitada");
    this.name = "FotoJaDecididaError";
  }
}
