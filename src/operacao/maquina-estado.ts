import type { tipoOsEnum } from "@/db/schema";
import type { EstadoOs } from "./orcamento-repo";
import { OsInexistenteError, type TransicaoRepo } from "./transicao-repo";

export type TipoOs = (typeof tipoOsEnum.enumValues)[number];

export interface ContextoOs {
  /** Tipo da OS — define qual caminho de estados é válido. */
  tipo: TipoOs;
  /** Estado atual da OS. */
  estado: EstadoOs;
  /** Estados já percorridos (inclui o atual). Usado pela regra NO_LOCAL. */
  historico: EstadoOs[];
  /** COMPLEMENTAR com cliente presente (aprovação presencial). */
  presencial?: boolean;
}

export interface Geo {
  lat: number;
  lon: number;
}

export interface TransicaoRegistro {
  estadoAnterior: EstadoOs;
  estadoNovo: EstadoOs;
  atorEmail: string;
  em: string;
  motivo: string | null;
  lat?: number;
  lon?: number;
}

/** Transições incondicionais permitidas a partir de cada estado. */
const TRANSICOES: Partial<Record<EstadoOs, EstadoOs[]>> = {
  NOVA: ["ORCADA"],
  ORCADA: ["APROVADA", "REJEITADA", "EXPIRADA"],
  APROVADA: ["AGENDADA", "A_CAMINHO"],
  AGENDADA: ["A_CAMINHO"],
  A_CAMINHO: ["NO_LOCAL"],
  NO_LOCAL: ["EM_EXECUCAO"],
  EM_EXECUCAO: ["CONCLUIDA"],
  CONCLUIDA: ["PAGA"],
};

export function transicionar(
  ctx: ContextoOs,
  alvo: EstadoOs,
  atorEmail: string,
  motivo: string | null = null,
  agora: Date = new Date(),
  geo?: Geo,
): TransicaoRegistro {
  const permitidas = TRANSICOES[ctx.estado] ?? [];
  const ok =
    (permitidas.includes(alvo) && !bloqueiaPagamento(ctx, alvo)) ||
    permiteExecucaoImediata(ctx, alvo) ||
    permiteAberturaGarantia(ctx, alvo);
  if (!ok) {
    throw new TransicaoInvalidaError(ctx.estado, alvo);
  }

  return {
    estadoAnterior: ctx.estado,
    estadoNovo: alvo,
    atorEmail,
    em: agora.toISOString(),
    motivo,
    lat: geo?.lat,
    lon: geo?.lon,
  };
}

/**
 * APROVADA → EM_EXECUCAO direta: o técnico já está NO_LOCAL e executa na hora.
 * Vale quando a OS já passou por NO_LOCAL (Visita Técnica), ou é EXPRESS, ou
 * COMPLEMENTAR com cliente presente (aprovação presencial).
 */
function permiteExecucaoImediata(ctx: ContextoOs, alvo: EstadoOs): boolean {
  if (ctx.estado !== "APROVADA" || alvo !== "EM_EXECUCAO") return false;
  return (
    ctx.historico.includes("NO_LOCAL") ||
    ctx.tipo === "EXPRESS" ||
    (ctx.tipo === "COMPLEMENTAR" && ctx.presencial === true)
  );
}

/**
 * PAGA → GARANTIA_ABERTA (tipos pagos) e CONCLUIDA → GARANTIA_ABERTA (tipo GARANTIA).
 */
function permiteAberturaGarantia(ctx: ContextoOs, alvo: EstadoOs): boolean {
  if (alvo !== "GARANTIA_ABERTA") return false;
  const pagos = ctx.tipo === "NORMAL" || ctx.tipo === "EXPRESS" || ctx.tipo === "COMPLEMENTAR";
  return (
    (ctx.estado === "PAGA" && pagos) ||
    (ctx.estado === "CONCLUIDA" && ctx.tipo === "GARANTIA")
  );
}

/**
 * OS Preventiva e de Garantia não têm custo — terminam em CONCLUIDA, sem PAGA.
 */
function bloqueiaPagamento(ctx: ContextoOs, alvo: EstadoOs): boolean {
  return (
    alvo === "PAGA" && (ctx.tipo === "PREVENTIVA" || ctx.tipo === "GARANTIA")
  );
}


/**
 * Caso de uso: valida a transição pela máquina (pura) e persiste o resultado
 * (histórico + novo estado da OS). Lança TransicaoInvalidaError se proibida.
 */
export async function aplicarTransicao(
  osId: string,
  alvo: EstadoOs,
  atorEmail: string,
  motivo: string | null,
  repo: TransicaoRepo,
  agora: Date = new Date(),
  geo?: Geo,
): Promise<TransicaoRegistro> {
  const ctx = await repo.carregarContexto(osId);
  if (!ctx) throw new OsInexistenteError();

  const registro = transicionar(ctx, alvo, atorEmail, motivo, agora, geo);
  await repo.persistir(osId, registro);
  return registro;
}

export class TransicaoInvalidaError extends Error {
  readonly status = 409;
  constructor(de: EstadoOs, para: EstadoOs) {
    super(`Transição inválida: ${de} → ${para}`);
    this.name = "TransicaoInvalidaError";
  }
}
