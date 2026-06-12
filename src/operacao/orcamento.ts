import type {
  Categoria,
  ItemPersistir,
  OrcamentoRepo,
  ServicoPreco,
} from "./orcamento-repo";
import { calcularDeslocamento } from "./deslocamento-calculo";
import { aplicarDescontoPlano } from "./desconto-plano";
import {
  EstadoInvalidoError,
  ItensObrigatorioError,
  NaoAtribuidoError,
  NaoTecnicoError,
  OrcamentoInvalidoError,
  OsIndisponivelError,
  ServicoInvalidoError,
} from "./orcamento-repo";

/** Validade padrão de um orçamento, em dias (ADR/glossário). */
export const VALIDADE_DIAS = 7;

export interface ConfigDeslocamento {
  precoLitro: string;
  kmPorLitro: string;
}

export interface UsuarioOrcamento {
  membroId: string;
  isTecnico: boolean;
}

export interface ItemOrcamentoInput {
  servicoId: string;
  quantidade: string;
}

export interface MontarOrcamentoInput {
  osId: string;
  itens: ItemOrcamentoInput[];
  km: number;
  /** Se informado, ignora o cálculo automático e usa este valor. */
  deslocamentoOverride?: string | null;
}

export interface OrcamentoMontado {
  id: string;
}

function somar(valores: string[]): string {
  return valores.reduce((acc, v) => acc + Number(v), 0).toFixed(2);
}

function validarOverride(valor: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) {
    throw new OrcamentoInvalidoError(
      "O valor de deslocamento informado é inválido",
    );
  }
  return n.toFixed(2);
}

export interface OrcamentoCalculado {
  itens: ItemPersistir[];
  totalMaoDeObra: string;
  totalDeslocamento: string;
  total: string;
}

/** Apenas o que o cálculo precisa do repositório (preços do Catálogo). */
export interface PrecosRepo {
  buscarPrecosServicos(ids: string[]): Promise<ServicoPreco[]>;
}

/**
 * Núcleo de cálculo de um orçamento: valida itens/km, resolve preços do
 * Catálogo, soma itens + deslocamento e valida o total. Puro quanto a estado da
 * OS — reusado tanto pela montagem (slice 7) quanto pela Complementar (slice 7).
 */
export async function calcularOrcamento(
  itensInput: ItemOrcamentoInput[],
  categoria: Categoria,
  km: number,
  deslocamentoOverride: string | null | undefined,
  config: ConfigDeslocamento,
  repo: PrecosRepo,
): Promise<OrcamentoCalculado> {
  if (itensInput.length === 0) throw new ItensObrigatorioError();
  if (km < 0) {
    throw new OrcamentoInvalidoError("O km de deslocamento não pode ser negativo");
  }

  const itens = await montarItens(itensInput, categoria, repo);
  const totalMaoDeObra = somar(itens.map((i) => i.subtotal));

  const totalDeslocamento =
    deslocamentoOverride != null
      ? validarOverride(deslocamentoOverride)
      : calcularDeslocamento(km, config.precoLitro, config.kmPorLitro);

  const total = somar([totalMaoDeObra, totalDeslocamento]);
  if (Number(total) <= 0) {
    throw new OrcamentoInvalidoError("O total do orçamento deve ser maior que zero");
  }

  return { itens, totalMaoDeObra, totalDeslocamento, total };
}

/**
 * Técnico atribuído monta o orçamento de uma OS NOVA: valida posse e estado,
 * usa preços autoritativos do Catálogo, soma itens + deslocamento e persiste,
 * transitando a OS para ORÇADA. Não envia notificação (slice 8).
 */
export async function montarOrcamento(
  input: MontarOrcamentoInput,
  usuario: UsuarioOrcamento,
  config: ConfigDeslocamento,
  repo: OrcamentoRepo,
): Promise<OrcamentoMontado> {
  if (!usuario.isTecnico) throw new NaoTecnicoError();

  const os = await repo.carregarOsParaOrcamento(input.osId);
  if (!os) throw new OsIndisponivelError();
  if (os.tecnicoId !== usuario.membroId) throw new NaoAtribuidoError();
  if (os.estado !== "NOVA") throw new EstadoInvalidoError();

  const calc = await calcularOrcamento(
    input.itens,
    os.categoria,
    input.km,
    input.deslocamentoOverride,
    config,
    repo,
  );

  // Desconto de plano: aplica o percentual do plano se o cliente da OS tem
  // assinatura ATIVA (regra de "ATIVA" mora na query do repo). Congela o valor
  // no orçamento — histórico imutável mesmo se a assinatura mudar depois.
  const percentual =
    (await repo.buscarPercentualDescontoAssinante?.(os.id)) ?? "0";
  const { desconto: descontoPlano, totalLiquido: totalComPlano } = aplicarDescontoPlano(
    calc.total,
    percentual,
  );

  // Desconto de indicação: verifica se o cliente possui indicação pendente e aplica o desconto
  const valorDescontoIndicacao =
    (await repo.buscarDescontoIndicacaoDisponivel?.(os.id)) ?? "0.00";

  // Deduz o valor e garante que o total líquido final não seja negativo
  const totalCents = Math.round(Number(totalComPlano) * 100);
  const descIndicacaoCents = Math.round(Number(valorDescontoIndicacao) * 100);
  const totalFinalCents = Math.max(0, totalCents - descIndicacaoCents);
  const totalFinal = (totalFinalCents / 100).toFixed(2);
  const descIndicacaoAplicado = ((totalCents - totalFinalCents) / 100).toFixed(2);

  const diasValidade = repo.obterValidadeDias ? await repo.obterValidadeDias() : VALIDADE_DIAS;
  const validoAte = new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000);

  const criado = await repo.criarParaOs({
    osId: os.id,
    tecnicoId: usuario.membroId,
    itens: calc.itens,
    totalMaoDeObra: calc.totalMaoDeObra,
    totalDeslocamento: calc.totalDeslocamento,
    descontoPlano: descontoPlano,
    percentualDescontoPlano: percentual,
    descontoIndicacao: descIndicacaoAplicado,
    total: totalFinal,
    validoAte,
  });
  if (!criado) throw new OsIndisponivelError();

  // Despacha as notificações de ORÇADA pelo módulo Transição de OS, de forma
  // assíncrona e não-bloqueante. A persistência NOVA→ORCADA é do portão
  // atômico de criarParaOs (acoplada à criação/compensação do orçamento),
  // então aqui só o despacho — não o transicionarOs completo.
  const { despacharEventoTransicao } = await import("@/operacao/transicionar-os");
  void despacharEventoTransicao(os.id, "ORCADA");

  return { id: criado.id };
}

async function montarItens(
  entradas: ItemOrcamentoInput[],
  categoriaOs: Categoria,
  repo: PrecosRepo,
): Promise<ItemPersistir[]> {
  // Consolida quantidades por serviço — itens repetidos viram uma linha só.
  const quantidadePorServico = new Map<string, number>();
  for (const item of entradas) {
    const qtd = Number(item.quantidade);
    if (!(qtd > 0)) {
      throw new ServicoInvalidoError("Quantidade deve ser maior que zero");
    }
    quantidadePorServico.set(
      item.servicoId,
      (quantidadePorServico.get(item.servicoId) ?? 0) + qtd,
    );
  }

  const precos = await repo.buscarPrecosServicos([...quantidadePorServico.keys()]);
  const porId = new Map(precos.map((p) => [p.id, p]));

  return [...quantidadePorServico].map(([servicoId, qtd]) => {
    const srv = porId.get(servicoId);
    if (!srv || !srv.ativo) {
      throw new ServicoInvalidoError("Serviço inexistente ou inativo");
    }
    if (srv.categoria !== categoriaOs) {
      throw new ServicoInvalidoError("Serviço de categoria diferente da OS");
    }
    const precoUnitario = Number(srv.precoBase);
    return {
      servicoId,
      quantidade: qtd.toFixed(2),
      precoUnitario: precoUnitario.toFixed(2),
      subtotal: (qtd * precoUnitario).toFixed(2),
    };
  });
}
