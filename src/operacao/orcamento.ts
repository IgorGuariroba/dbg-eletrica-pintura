import type {
  Categoria,
  ItemPersistir,
  OrcamentoRepo,
} from "./orcamento-repo";
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

/**
 * Deslocamento = (km × preço do litro) ÷ km por litro.
 * Valores monetários circulam como string decimal (mesmo padrão do Catálogo).
 */
export function calcularDeslocamento(
  km: number,
  precoLitro: string,
  kmPorLitro: string,
): string {
  const litros = km / Number(kmPorLitro);
  const valor = litros * Number(precoLitro);
  return valor.toFixed(2);
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

  if (input.itens.length === 0) throw new ItensObrigatorioError();
  if (input.km < 0) {
    throw new OrcamentoInvalidoError("O km de deslocamento não pode ser negativo");
  }

  const itens = await montarItens(input.itens, os.categoria, repo);
  const totalItens = somar(itens.map((i) => i.subtotal));

  const deslocamento =
    input.deslocamentoOverride != null
      ? validarOverride(input.deslocamentoOverride)
      : calcularDeslocamento(input.km, config.precoLitro, config.kmPorLitro);

  const total = somar([totalItens, deslocamento]);
  if (Number(total) <= 0) {
    throw new OrcamentoInvalidoError("O total do orçamento deve ser maior que zero");
  }

  const validoAte = new Date(Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  const criado = await repo.criarParaOs({
    osId: os.id,
    tecnicoId: usuario.membroId,
    itens,
    totalMaoDeObra: totalItens,
    totalDeslocamento: deslocamento,
    total,
    validoAte,
  });
  if (!criado) throw new OsIndisponivelError();
  return { id: criado.id };
}

async function montarItens(
  entradas: ItemOrcamentoInput[],
  categoriaOs: Categoria,
  repo: OrcamentoRepo,
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
