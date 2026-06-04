import type { Categoria } from "@/equipe/membro-repo";
import type { TipoOs } from "@/operacao/maquina-estado";
import type { JanelaOriginal } from "@/documentos/janela-garantia";
import { avaliarAcionamentoGarantia } from "./avaliar-acionamento";
import { ForaDoPrazoError } from "./acionar-garantia";

export class ChamadoInexistenteError extends Error {
  constructor() {
    super("Chamado de garantia não encontrado");
    this.name = "ChamadoInexistenteError";
  }
}

export class ChamadoJaDecididoError extends Error {
  constructor() {
    super("Chamado de garantia já foi decidido");
    this.name = "ChamadoJaDecididoError";
  }
}

export class JustificativaObrigatoriaError extends Error {
  constructor() {
    super("Justificativa é obrigatória para override fora do prazo");
    this.name = "JustificativaObrigatoriaError";
  }
}

export class MotivoRejeicaoObrigatorioError extends Error {
  constructor() {
    super("Motivo da rejeição é obrigatório");
    this.name = "MotivoRejeicaoObrigatorioError";
  }
}

export interface ChamadoDecisao {
  id: string;
  status: "pendente" | "aplicada" | "rejeitada";
  osOrigemId: string;
  ancora: JanelaOriginal & { ancoraId: string; tipo: TipoOs };
  categoria: Categoria;
  tecnicoOriginalId: string | null;
  tecnicoOriginalDisponivel: boolean;
}

export interface ChamadoPendenteLista {
  id: string;
  descricao: string;
  fotoUrl: string;
  criadoEm: Date;
  criadoPor: string;
  canal: "PORTAL" | "WHATSAPP";
  temComplementarRejeitado: boolean;
  acionamentoInvalido: boolean;
  osOrigem: {
    id: string;
    tipo: TipoOs;
    estado: string;
    categoria: Categoria;
  };
  cliente: {
    nome: string;
    whatsapp: string;
  };
  tecnicoOriginal: {
    id: string | null;
    nome: string | null;
  } | null;
  prazo: {
    dentroDoPrazo: boolean;
    fim: Date;
  };
}

export interface GarantiaDecisaoRepo {
  carregarChamado(chamadoId: string): Promise<ChamadoDecisao | null>;
  listarChamadosPendentes(): Promise<ChamadoPendenteLista[]>;
  aplicar(dados: {
    chamadoId: string;
    osOrigemId: string;
    categoria: Categoria;
    prazoMeses: number;
    tecnicoId: string | null;
    decididoPor: string;
    override: { justificativa: string } | null;
  }): Promise<{ osGarantiaId: string }>;
  rejeitar(chamadoId: string, motivo: string, decididoPor: string): Promise<void>;
}

export interface AplicarGarantiaInput {
  chamadoId: string;
  decididoPor: string;
  override?: { justificativa: string } | null;
}

export interface AplicarGarantiaDeps {
  repo: GarantiaDecisaoRepo;
  notificar?: (osGarantiaId: string) => Promise<void>;
  agora?: Date;
}

export async function aplicarGarantia(
  input: AplicarGarantiaInput,
  deps: AplicarGarantiaDeps,
): Promise<{ osGarantiaId: string; tecnicoAtribuido: boolean }> {
  const chamado = await deps.repo.carregarChamado(input.chamadoId);
  if (!chamado) {
    throw new ChamadoInexistenteError();
  }

  if (chamado.status !== "pendente") {
    throw new ChamadoJaDecididoError();
  }

  const agora = deps.agora ?? new Date();

  // Evaluate warranty period
  const avaliacao = avaliarAcionamentoGarantia({
    agora,
    ancora: chamado.ancora,
    temComplementarRejeitado: false, // We're not assessing portal auto-flag here
  });

  let overrideParams: { justificativa: string } | null = null;

  if (!avaliacao.dentroDoPrazo) {
    if (!input.override || !input.override.justificativa.trim()) {
      if (input.override) {
        throw new JustificativaObrigatoriaError();
      }
      throw new ForaDoPrazoError();
    }
    overrideParams = { justificativa: input.override.justificativa.trim() };
  }

  const tecnicoId = chamado.tecnicoOriginalDisponivel ? chamado.tecnicoOriginalId : null;
  const tecnicoAtribuido = chamado.tecnicoOriginalDisponivel && chamado.tecnicoOriginalId != null;

  const { osGarantiaId } = await deps.repo.aplicar({
    chamadoId: chamado.id,
    osOrigemId: chamado.osOrigemId,
    categoria: chamado.categoria,
    prazoMeses: chamado.ancora.prazoMeses,
    tecnicoId,
    decididoPor: input.decididoPor,
    override: overrideParams,
  });

  if (deps.notificar) {
    await deps.notificar(osGarantiaId);
  }

  return {
    osGarantiaId,
    tecnicoAtribuido,
  };
}

export async function rejeitarGarantia(
  input: { chamadoId: string; motivo: string; decididoPor: string },
  deps: { repo: GarantiaDecisaoRepo },
): Promise<void> {
  if (!input.motivo.trim()) {
    throw new MotivoRejeicaoObrigatorioError();
  }

  const chamado = await deps.repo.carregarChamado(input.chamadoId);
  if (!chamado) {
    throw new ChamadoInexistenteError();
  }

  if (chamado.status !== "pendente") {
    throw new ChamadoJaDecididoError();
  }

  await deps.repo.rejeitar(input.chamadoId, input.motivo.trim(), input.decididoPor);
}
