import { OsNaoOrcadaError } from "./aprovacao-repo";

export type Origem = "FORMULARIO" | "EXPRESS" | "MANUAL" | "EXPRESS_TECNICO";

export interface AprovacaoPresencialInput {
  /** Cliente marcou que aprova o orçamento. */
  aprovou: boolean;
  /** Cliente marcou aceite verbal da LGPD. */
  lgpdAceito: boolean;
  /** Heurística já avaliada: o canvas tem traço (assinatura não vazia). */
  assinaturaPreenchida: boolean;
  /** Origem da Solicitação — EXPRESS já coletou LGPD no momento da criação. */
  origem: Origem;
}

/**
 * Valida as pré-condições da aprovação presencial (assinada no PWA do técnico).
 * Pura: não toca em I/O. Lança erro tipado na primeira regra violada.
 */
export function validarAprovacaoPresencial(input: AprovacaoPresencialInput): void {
  if (!input.aprovou) throw new AprovacaoNaoConfirmadaError();
  // Express já coletou o aceite verbal da LGPD ao criar a Solicitação no local.
  if (input.origem !== "EXPRESS_TECNICO" && !input.lgpdAceito) {
    throw new LgpdNaoAceitaError();
  }
  if (!input.assinaturaPreenchida) throw new AssinaturaVaziaError();
}

/**
 * Heurística mínima de "assinatura não vazia": um canvas em branco produz um
 * PNG altamente compressível (poucos bytes); um traço real aumenta o tamanho.
 * Decodifica o payload base64 do data URL e compara com um piso de bytes.
 */
export function assinaturaPreenchida(
  dataUrl: string,
  minBytes = 1024,
): boolean {
  const virgula = dataUrl.indexOf(",");
  if (virgula < 0) return false;
  const base64 = dataUrl.slice(virgula + 1);
  if (!base64) return false;
  const bytes = Buffer.from(base64, "base64").length;
  return bytes >= minBytes;
}

/** Envia o PNG da assinatura ao storage privado e devolve a chave/URL. */
export interface UploadAssinatura {
  enviarAssinatura(input: {
    osId: string;
    dataUrl: string;
  }): Promise<{ url: string }>;
}

export interface AprovacaoPresencialRepo {
  /**
   * Grava a aprovação presencial no orçamento e transita ORCADA→APROVADA
   * atomicamente. Retorna false se a OS não está mais ORÇADA.
   */
  aprovarPresencial(input: {
    osId: string;
    assinaturaUrl: string;
    aprovadoPor: string;
    lgpdAceito: boolean;
    em: Date;
  }): Promise<boolean>;
  /**
   * Indica se a máquina de estados permite APROVADA→EM_EXECUCAO já (técnico
   * NO_LOCAL no histórico, ou tipo EXPRESS) — para oferecer "iniciar agora".
   */
  podeIniciarExecucao(osId: string): Promise<boolean>;
}

export interface DadosAprovacaoPresencial {
  osId: string;
  aprovou: boolean;
  lgpdAceito: boolean;
  origem: Origem;
  assinaturaDataUrl: string;
  tecnicoEmail: string;
}

export interface ResultadoAprovacaoPresencial {
  assinaturaUrl: string;
  podeIniciarExecucao: boolean;
}

/**
 * Caso de uso da aprovação presencial: valida (puro), envia a assinatura,
 * grava a aprovação + transita ORCADA→APROVADA, e diz se cabe oferecer o
 * início imediato da execução.
 */
export async function aprovarPresencial(
  dados: DadosAprovacaoPresencial,
  deps: { repo: AprovacaoPresencialRepo; upload: UploadAssinatura; agora?: Date },
): Promise<ResultadoAprovacaoPresencial> {
  validarAprovacaoPresencial({
    aprovou: dados.aprovou,
    lgpdAceito: dados.lgpdAceito,
    assinaturaPreenchida: assinaturaPreenchida(dados.assinaturaDataUrl),
    origem: dados.origem,
  });

  const { url } = await deps.upload.enviarAssinatura({
    osId: dados.osId,
    dataUrl: dados.assinaturaDataUrl,
  });

  const ok = await deps.repo.aprovarPresencial({
    osId: dados.osId,
    assinaturaUrl: url,
    aprovadoPor: dados.tecnicoEmail,
    lgpdAceito: dados.lgpdAceito,
    em: deps.agora ?? new Date(),
  });
  if (!ok) throw new OsNaoOrcadaError();

  const podeIniciarExecucao = await deps.repo.podeIniciarExecucao(dados.osId);
  return { assinaturaUrl: url, podeIniciarExecucao };
}

export class LgpdNaoAceitaError extends Error {
  readonly status = 422;
  constructor() {
    super("É obrigatório registrar o aceite da LGPD pelo cliente");
    this.name = "LgpdNaoAceitaError";
  }
}

export class AprovacaoNaoConfirmadaError extends Error {
  readonly status = 422;
  constructor() {
    super("É obrigatório confirmar que o cliente aprovou o orçamento");
    this.name = "AprovacaoNaoConfirmadaError";
  }
}

export class AssinaturaVaziaError extends Error {
  readonly status = 422;
  constructor() {
    super("A assinatura do cliente é obrigatória");
    this.name = "AssinaturaVaziaError";
  }
}
