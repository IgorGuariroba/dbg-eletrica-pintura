import {
  EstadoInvalidoError,
  NaoAtribuidoError,
  type EstadoOs,
} from "./orcamento-repo";

export interface OsReagendavel {
  estado: EstadoOs;
  tecnicoId: string | null;
  agendadoPara: Date | null;
}

export interface RegistroTransicao {
  estadoAnterior: EstadoOs;
  estadoNovo: EstadoOs;
  atorEmail: string;
  motivo: string | null;
  em: Date;
}

export interface ReagendamentoRepo {
  carregar(osId: string): Promise<OsReagendavel | null>;
  /** Devolve a OS à fila: técnico null + novo estado + histórico. */
  cancelar(
    osId: string,
    novoEstado: EstadoOs,
    registro: RegistroTransicao,
  ): Promise<void>;
  /** Reagenda: novo slot + estado AGENDADA + histórico. */
  reagendar(
    osId: string,
    novoSlot: Date,
    registro: RegistroTransicao,
    tecnicoId?: string | null,
  ): Promise<void>;
  /** Cancela para APROVADA: técnico null + data null + estado APROVADA + histórico. */
  cancelarParaAprovada(
    osId: string,
    registro: RegistroTransicao,
  ): Promise<void>;
}

export interface UsuarioTecnico {
  membroId: string;
  email: string;
}

export async function cancelarOsTecnico(
  osId: string,
  usuario: UsuarioTecnico,
  motivo: string,
  repo: ReagendamentoRepo,
  agora: Date = new Date(),
): Promise<void> {
  const os = await repo.carregar(osId);
  if (!os) throw new OsInexistenteError();
  if (os.tecnicoId !== usuario.membroId) throw new NaoAtribuidoError();
  if (os.estado === "EM_EXECUCAO") throw new CancelamentoEmExecucaoError();
  const motivoLimpo = exigirMotivo(motivo);

  // Devolve à fila: se já tinha horário marcado volta como AGENDADA; senão,
  // antes do agendamento, regride para ORÇADA. O repo zera o técnico.
  const novoEstado: EstadoOs = os.agendadoPara ? "AGENDADA" : "ORCADA";
  await repo.cancelar(osId, novoEstado, {
    estadoAnterior: os.estado,
    estadoNovo: novoEstado,
    atorEmail: usuario.email,
    motivo: motivoLimpo,
    em: agora,
  });
}

/** Estados a partir dos quais o técnico pode reagendar a visita. */
const REAGENDAVEIS: EstadoOs[] = ["AGENDADA", "A_CAMINHO", "NO_LOCAL"];
/** A partir destes, reagendar/cancelar exige motivo (o técnico já saiu). */
const EXIGE_MOTIVO: EstadoOs[] = ["A_CAMINHO", "NO_LOCAL"];

export async function reagendarOsTecnico(
  osId: string,
  usuario: UsuarioTecnico,
  novoSlot: Date,
  motivo: string | null,
  repo: ReagendamentoRepo,
  agora: Date = new Date(),
): Promise<void> {
  const os = await repo.carregar(osId);
  if (!os) throw new OsInexistenteError();
  if (os.tecnicoId !== usuario.membroId) throw new NaoAtribuidoError();
  if (!REAGENDAVEIS.includes(os.estado)) throw new EstadoInvalidoError();

  // Depois de A_CAMINHO a visita já estava em curso — motivo é obrigatório.
  const motivoLimpo = EXIGE_MOTIVO.includes(os.estado)
    ? exigirMotivo(motivo)
    : motivo?.trim() || null;

  await repo.reagendar(osId, novoSlot, {
    estadoAnterior: os.estado,
    estadoNovo: "AGENDADA",
    atorEmail: usuario.email,
    motivo: motivoLimpo,
    em: agora,
  });
}

const MOTIVO_MIN = 10;

/** Motivo de cancelamento/reagendamento tardio: texto com no mínimo 10 chars. */
function exigirMotivo(motivo: string | null | undefined): string {
  const limpo = motivo?.trim() ?? "";
  if (limpo.length < MOTIVO_MIN) throw new MotivoObrigatorioError();
  return limpo;
}

export class OsInexistenteError extends Error {
  readonly status = 404;
  constructor() {
    super("OS não encontrada");
    this.name = "OsInexistenteError";
  }
}

export class MotivoObrigatorioError extends Error {
  readonly status = 422;
  constructor() {
    super("Informe um motivo com pelo menos 10 caracteres");
    this.name = "MotivoObrigatorioError";
  }
}

export class CancelamentoEmExecucaoError extends Error {
  readonly status = 409;
  constructor() {
    super(
      "OS em execução não pode ser cancelada — crie um Orçamento Complementar ou marque como aguardando",
    );
    this.name = "CancelamentoEmExecucaoError";
  }
}

/** > 24h até o horário agendado: cliente pode mexer sozinho. */
export function dentroDaJanelaCliente(agendadoPara: Date, agora: Date): boolean {
  const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
  return agendadoPara.getTime() - agora.getTime() <= VINTE_QUATRO_HORAS_MS;
}

export class ForaDaJanelaError extends Error {
  readonly status = 409;
  constructor() {
    super("Fora da janela de reagendamento/cancelamento (menos de 24h restantes)");
    this.name = "ForaDaJanelaError";
  }
}

export async function cancelarOsCliente(
  osId: string,
  cliente: { whatsapp: string },
  repo: ReagendamentoRepo,
  agora: Date = new Date(),
): Promise<void> {
  const os = await repo.carregar(osId);
  if (!os) throw new OsInexistenteError();

  if (os.estado !== "AGENDADA") {
    throw new EstadoInvalidoError();
  }

  if (os.agendadoPara && dentroDaJanelaCliente(os.agendadoPara, agora)) {
    throw new ForaDaJanelaError();
  }

  await repo.cancelarParaAprovada(osId, {
    estadoAnterior: os.estado,
    estadoNovo: "APROVADA",
    atorEmail: `cliente:${cliente.whatsapp}`,
    motivo: null,
    em: agora,
  });
}

export async function reagendarOsCliente(
  osId: string,
  cliente: { whatsapp: string },
  novoSlot: Date,
  tecnicoId: string | null,
  repo: ReagendamentoRepo,
  agora: Date = new Date(),
): Promise<void> {
  const os = await repo.carregar(osId);
  if (!os) throw new OsInexistenteError();

  if (os.estado !== "AGENDADA") {
    throw new EstadoInvalidoError();
  }

  if (os.agendadoPara && dentroDaJanelaCliente(os.agendadoPara, agora)) {
    throw new ForaDaJanelaError();
  }

  await repo.reagendar(osId, novoSlot, {
    estadoAnterior: os.estado,
    estadoNovo: "AGENDADA",
    atorEmail: `cliente:${cliente.whatsapp}`,
    motivo: null,
    em: agora,
  }, tecnicoId);
}


