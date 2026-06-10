import type { Categoria, EstadoOs } from "./orcamento-repo";
import type { AgendamentoRepo } from "./agendamento-repo";

import { calcularSlotsDisponiveis } from "./slots";

export class OsInexistenteError extends Error {
  readonly status = 404;
  constructor(message = "OS não encontrada") {
    super(message);
    this.name = "OsInexistenteError";
  }
}

export class OsNaoAgendavelError extends Error {
  readonly status = 409;
  constructor(message = "Esta OS não está disponível para agendamento") {
    super(message);
    this.name = "OsNaoAgendavelError";
  }
}

export class SlotNaoEncontradoError extends Error {
  readonly status = 409;
  constructor(message = "Este horário não está mais disponível") {
    super(message);
    this.name = "SlotNaoEncontradoError";
  }
}

export class SlotIndisponivelError extends Error {
  readonly status = 409;
  constructor(public readonly tecnicoId: string, public readonly agendadoPara: Date) {
    super(`Slot indisponível para o técnico ${tecnicoId} em ${agendadoPara.toISOString()}`);
    this.name = "SlotIndisponivelError";
  }
}

export class ForaDaJanelaError extends Error {
  readonly status = 409;
  constructor(message = "Fora da janela de reagendamento/cancelamento (menos de 24h restantes)") {
    super(message);
    this.name = "ForaDaJanelaError";
  }
}

/** > 24h até o horário agendado: cliente pode mexer sozinho. */
export function dentroDaJanelaCliente(agendadoPara: Date, agora: Date): boolean {
  const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
  return agendadoPara.getTime() - agora.getTime() <= VINTE_QUATRO_HORAS_MS;
}

export class NaoAtribuidoError extends Error {
  readonly status = 403;
  constructor(message = "OS não atribuída a este técnico") {
    super(message);
    this.name = "NaoAtribuidoError";
  }
}

export class MotivoObrigatorioError extends Error {
  readonly status = 422;
  constructor(message = "Informe um motivo com pelo menos 10 caracteres") {
    super(message);
    this.name = "MotivoObrigatorioError";
  }
}

export class CancelamentoEmExecucaoError extends Error {
  readonly status = 409;
  constructor(message = "OS em execução não pode ser cancelada — crie um Orçamento Complementar ou marque como aguardando") {
    super(message);
    this.name = "CancelamentoEmExecucaoError";
  }
}

export interface AgendamentoService {
  obterSlotsCliente(token: string, osId: string): Promise<{ inicio: Date; prioridade?: boolean }[]>;
  obterSlotsAdmin(osId: string): Promise<{ inicio: Date; prioridade?: boolean }[]>;
  agendarCliente(token: string, osId: string, horario: Date): Promise<void>;
  cancelarCliente(token: string, osId: string, whatsapp: string): Promise<void>;
  reagendarCliente(
    token: string,
    osId: string,
    whatsapp: string,
    novoHorario: Date
  ): Promise<void>;

  reagendarTecnico(
    osId: string,
    tecnicoId: string,
    email: string,
    novoHorario: Date,
    motivo: string | null
  ): Promise<void>;
  cancelarTecnico(osId: string, tecnicoId: string, email: string, motivo: string): Promise<void>;

  reagendarAdmin(osId: string, adminEmail: string, novoHorario: Date, motivo: string): Promise<void>;
  cancelarAdmin(osId: string, adminEmail: string, motivo?: string): Promise<void>;
  cancelarLoteAdmin(
    osIds: string[],
    adminEmail: string,
    motivo: string
  ): Promise<{ osId: string; ok: boolean; erro?: string }[]>;
}

/** Estados em que o admin pode reagendar uma OS (pré-execução). */
const REAGENDAVEIS_ADMIN: EstadoOs[] = ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"];

export class AgendamentoServiceImpl implements AgendamentoService {
  constructor(private readonly repo: AgendamentoRepo) {}

  /** Grade de slots disponíveis para os próximos 14 dias de uma categoria. */
  private async calcularGradeSlots(categoria: Categoria, assinante: boolean) {
    const inicio = new Date();
    const fim = new Date(inicio.getTime() + 14 * 24 * 60 * 60 * 1000);

    const tecnicos = await this.repo.listarTecnicosAgendaveis(categoria);
    const horarioComercial = await this.repo.obterHorarioComercial();

    return calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria,
      horarioComercial,
      tecnicos,
      assinante,
    });
  }

  /** Achata a grade em horários únicos, preservando a flag de prioridade. */
  private async gradeUnica(categoria: Categoria, assinante: boolean) {
    const rawSlots = await this.calcularGradeSlots(categoria, assinante);

    const vistos = new Set<number>();
    const unicos: { inicio: Date; prioridade?: boolean }[] = [];
    for (const s of rawSlots) {
      const t = s.inicio.getTime();
      if (!vistos.has(t)) {
        vistos.add(t);
        unicos.push({
          inicio: s.inicio,
          ...(s.prioridade ? { prioridade: true } : {}),
        });
      }
    }

    return unicos;
  }

  async obterSlotsCliente(token: string, osId: string): Promise<{ inicio: Date; prioridade?: boolean }[]> {
    const os = await this.repo.buscarOsComToken(token, osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.estado !== "APROVADA") {
      throw new OsNaoAgendavelError();
    }

    return this.gradeUnica(os.categoria, os.clienteAssinante);
  }

  async obterSlotsAdmin(osId: string): Promise<{ inicio: Date; prioridade?: boolean }[]> {
    const os = await this.repo.buscarOs(osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (!REAGENDAVEIS_ADMIN.includes(os.estado)) {
      throw new OsNaoAgendavelError("OS não está em estado reagendável (pré-execução)");
    }

    return this.gradeUnica(os.categoria, os.clienteAssinante);
  }

  async agendarCliente(token: string, osId: string, horario: Date): Promise<void> {
    const os = await this.repo.buscarOsComToken(token, osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.estado !== "APROVADA") {
      throw new OsNaoAgendavelError();
    }

    const rawSlots = await this.calcularGradeSlots(os.categoria, os.clienteAssinante);

    const alvoTime = horario.getTime();
    const slot = rawSlots.find((s) => s.inicio.getTime() === alvoTime);
    if (!slot) {
      throw new SlotNaoEncontradoError();
    }

    await this.repo.salvarAgendamento(osId, slot.inicio, slot.tecnicoId, {
      estadoAnterior: os.estado,
      estadoNovo: "AGENDADA",
      atorEmail: `cliente:${token}`,
      motivo: null,
      em: new Date(),
    });
  }

  async cancelarCliente(token: string, osId: string, whatsapp: string): Promise<void> {
    const os = await this.repo.buscarOsComToken(token, osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.estado !== "AGENDADA") {
      throw new OsNaoAgendavelError("Apenas ordens agendadas podem ser canceladas");
    }

    const agora = new Date();
    if (os.agendadoPara && dentroDaJanelaCliente(os.agendadoPara, agora)) {
      throw new ForaDaJanelaError();
    }

    await this.repo.liberarAgendamento(osId, "APROVADA", {
      estadoAnterior: os.estado,
      estadoNovo: "APROVADA",
      atorEmail: `cliente:${whatsapp}`,
      motivo: null,
      em: agora,
    });
  }

  async reagendarCliente(
    token: string,
    osId: string,
    whatsapp: string,
    novoHorario: Date
  ): Promise<void> {
    const os = await this.repo.buscarOsComToken(token, osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.estado !== "AGENDADA") {
      throw new OsNaoAgendavelError("Apenas ordens agendadas podem ser reagendadas");
    }

    const agora = new Date();
    if (os.agendadoPara && dentroDaJanelaCliente(os.agendadoPara, agora)) {
      throw new ForaDaJanelaError();
    }

    const rawSlots = await this.calcularGradeSlots(os.categoria, os.clienteAssinante);

    const alvoTime = novoHorario.getTime();
    const slot = rawSlots.find((s) => s.inicio.getTime() === alvoTime);
    if (!slot) {
      throw new SlotNaoEncontradoError();
    }

    await this.repo.salvarAgendamento(osId, slot.inicio, slot.tecnicoId, {
      estadoAnterior: os.estado,
      estadoNovo: "AGENDADA",
      atorEmail: `cliente:${whatsapp}`,
      motivo: null,
      em: agora,
    });
  }

  async reagendarTecnico(
    osId: string,
    tecnicoId: string,
    email: string,
    novoHorario: Date,
    motivo: string | null
  ): Promise<void> {
    const os = await this.repo.buscarOs(osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.tecnicoId !== tecnicoId) {
      throw new NaoAtribuidoError();
    }

    const REAGENDAVEIS: EstadoOs[] = ["AGENDADA", "A_CAMINHO", "NO_LOCAL"];
    if (!REAGENDAVEIS.includes(os.estado)) {
      throw new OsNaoAgendavelError();
    }

    const EXIGE_MOTIVO: EstadoOs[] = ["A_CAMINHO", "NO_LOCAL"];
    const motivoLimpo = motivo?.trim() || null;
    if (EXIGE_MOTIVO.includes(os.estado)) {
      if (!motivoLimpo || motivoLimpo.length < 10) {
        throw new MotivoObrigatorioError();
      }
    }

    await this.repo.salvarAgendamento(osId, novoHorario, tecnicoId, {
      estadoAnterior: os.estado,
      estadoNovo: "AGENDADA",
      atorEmail: email,
      motivo: motivoLimpo,
      em: new Date(),
    });
  }

  async cancelarTecnico(osId: string, tecnicoId: string, email: string, motivo: string): Promise<void> {
    const os = await this.repo.buscarOs(osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (os.tecnicoId !== tecnicoId) {
      throw new NaoAtribuidoError();
    }
    if (os.estado === "EM_EXECUCAO") {
      throw new CancelamentoEmExecucaoError();
    }

    const motivoLimpo = motivo?.trim() || "";
    if (motivoLimpo.length < 10) {
      throw new MotivoObrigatorioError();
    }

    const novoEstado: EstadoOs = os.agendadoPara ? "AGENDADA" : "ORCADA";

    await this.repo.liberarAgendamento(osId, novoEstado, {
      estadoAnterior: os.estado,
      estadoNovo: novoEstado,
      atorEmail: email,
      motivo: motivoLimpo,
      em: new Date(),
    });
  }

  async reagendarAdmin(osId: string, adminEmail: string, novoHorario: Date, motivo: string): Promise<void> {
    const motivoLimpo = motivo?.trim() ?? "";
    if (motivoLimpo.length < 10) {
      throw new MotivoObrigatorioError();
    }

    const os = await this.repo.buscarOs(osId);
    if (!os) {
      throw new OsInexistenteError();
    }
    if (!REAGENDAVEIS_ADMIN.includes(os.estado)) {
      throw new OsNaoAgendavelError("OS não está em estado reagendável (pré-execução)");
    }

    const rawSlots = await this.calcularGradeSlots(os.categoria, os.clienteAssinante);
    const slot = rawSlots.find((s) => s.inicio.getTime() === novoHorario.getTime());
    if (!slot) {
      throw new SlotNaoEncontradoError();
    }

    await this.repo.salvarAgendamento(osId, slot.inicio, slot.tecnicoId, {
      estadoAnterior: os.estado,
      estadoNovo: "AGENDADA",
      atorEmail: adminEmail,
      motivo: motivoLimpo,
      em: new Date(),
    });
  }

  async cancelarAdmin(osId: string, adminEmail: string, motivo?: string): Promise<void> {
    const os = await this.repo.buscarOs(osId);
    if (!os) {
      throw new OsInexistenteError();
    }

    const novoEstado: EstadoOs = "APROVADA";

    await this.repo.liberarAgendamento(osId, novoEstado, {
      estadoAnterior: os.estado,
      estadoNovo: novoEstado,
      atorEmail: adminEmail,
      motivo: motivo || "Cancelamento administrativo",
      em: new Date(),
    });
  }

  async cancelarLoteAdmin(
    osIds: string[],
    adminEmail: string,
    motivo: string
  ): Promise<{ osId: string; ok: boolean; erro?: string }[]> {
    const motivoLimpo = motivo?.trim() ?? "";
    if (motivoLimpo.length < 10) {
      throw new MotivoObrigatorioError();
    }

    const resultados: { osId: string; ok: boolean; erro?: string }[] = [];

    for (const osId of osIds) {
      try {
        const os = await this.repo.buscarOs(osId);
        if (!os) {
          resultados.push({ osId, ok: false, erro: "OS não encontrada" });
          continue;
        }

        const PRE_EXECUCAO: EstadoOs[] = ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"];
        if (!PRE_EXECUCAO.includes(os.estado)) {
          resultados.push({
            osId,
            ok: false,
            erro: `OS no estado ${os.estado} não pode ser cancelada`,
          });
          continue;
        }

        await this.repo.liberarAgendamento(osId, "CANCELADA", {
          estadoAnterior: os.estado,
          estadoNovo: "CANCELADA",
          atorEmail: adminEmail,
          motivo: motivoLimpo,
          em: new Date(),
        });

        resultados.push({ osId, ok: true });
      } catch (err) {
        resultados.push({
          osId,
          ok: false,
          erro: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    return resultados;
  }
}

export function criarAgendamentoService(repo: AgendamentoRepo): AgendamentoService {
  return new AgendamentoServiceImpl(repo);
}
