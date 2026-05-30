import type {
  Categoria,
  EstadoOs,
  ItemPersistir,
  ServicoPreco,
} from "./orcamento-repo";
import {
  EstadoInvalidoError,
  NaoAtribuidoError,
  NaoTecnicoError,
  OsIndisponivelError,
} from "./orcamento-repo";
import {
  calcularOrcamento,
  VALIDADE_DIAS,
  type ConfigDeslocamento,
  type ItemOrcamentoInput,
} from "./orcamento";

export interface CriarComplementarInput {
  osPaiId: string;
  itens: ItemOrcamentoInput[];
  km: number;
  /** Sobrescreve o cálculo automático de deslocamento (decisão do técnico). */
  deslocamentoOverride?: string | null;
}

export interface UsuarioComplementar {
  membroId: string;
  isTecnico: boolean;
}

/** OS pai reduzida ao necessário para gerar a Complementar. */
export interface OsPai {
  id: string;
  estado: EstadoOs;
  tecnicoId: string | null;
  categoria: Categoria;
  solicitacaoId: string;
}

/** Dados para nascer a OS COMPLEMENTAR já ORÇADA, com orçamento e vínculo. */
export interface NovoComplementar {
  solicitacaoId: string;
  osPaiId: string;
  categoria: Categoria;
  tecnicoId: string;
  itens: ItemPersistir[];
  totalMaoDeObra: string;
  totalDeslocamento: string;
  total: string;
  validoAte: Date;
}

export interface ComplementarRepo {
  carregarPai(osPaiId: string): Promise<OsPai | null>;
  buscarPrecosServicos(ids: string[]): Promise<ServicoPreco[]>;
  /**
   * Cria a OS COMPLEMENTAR (tipo COMPLEMENTAR, estado ORÇADA, vinculada à pai e
   * atribuída ao técnico) com o orçamento + itens, de forma atômica.
   */
  criarComplementarComOrcamento(
    dados: NovoComplementar,
  ): Promise<{ osId: string; orcamentoId: string }>;
  marcarAguardando(osPaiId: string, complementarId: string): Promise<void>;
  listarComplementares(
    osPaiId: string,
  ): Promise<{ id: string; estado: EstadoOs }[]>;
}

/**
 * Técnico em campo (OS pai EM_EXECUÇÃO) cria um Orçamento Complementar: nova OS
 * COMPLEMENTAR vinculada à pai, nascendo direto em ORÇADA com o orçamento já
 * montado e o técnico criador atribuído (nunca entra na fila pública).
 */
export async function criarComplementar(
  input: CriarComplementarInput,
  usuario: UsuarioComplementar,
  config: ConfigDeslocamento,
  repo: ComplementarRepo,
): Promise<{ osId: string; orcamentoId: string }> {
  if (!usuario.isTecnico) throw new NaoTecnicoError();

  const pai = await repo.carregarPai(input.osPaiId);
  if (!pai) throw new OsIndisponivelError();
  if (pai.estado !== "EM_EXECUCAO") throw new EstadoInvalidoError();
  if (pai.tecnicoId !== usuario.membroId) throw new NaoAtribuidoError();

  const calc = await calcularOrcamento(
    input.itens,
    pai.categoria,
    input.km,
    input.deslocamentoOverride,
    config,
    repo,
  );

  const validoAte = new Date(Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  return repo.criarComplementarComOrcamento({
    solicitacaoId: pai.solicitacaoId,
    osPaiId: pai.id,
    categoria: pai.categoria,
    tecnicoId: usuario.membroId,
    itens: calc.itens,
    totalMaoDeObra: calc.totalMaoDeObra,
    totalDeslocamento: calc.totalDeslocamento,
    total: calc.total,
    validoAte,
  });
}
