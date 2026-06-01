import type { SolicitacaoView, OsView } from "./aprovacao-repo";
import type { SlotDisponivel } from "./slots";

/** Janela de agendamento oferecida ao cliente no link público. */
export const DIAS_AGENDAMENTO = 14;

export class OsNaoAgendavelError extends Error {
  readonly status = 409;
  constructor() {
    super("Esta OS não está disponível para agendamento");
    this.name = "OsNaoAgendavelError";
  }
}

export class SlotNaoEncontradoError extends Error {
  readonly status = 409;
  constructor() {
    super("Este horário não está mais disponível");
    this.name = "SlotNaoEncontradoError";
  }
}

/**
 * Garante que a OS pertence à Solicitação do token e está APROVADA — único
 * estado em que o cliente pode escolher um slot. Retorna a OsView escopada.
 */
export function validarOsAgendavel(view: SolicitacaoView, osId: string): OsView {
  const os = view.ordens.find((o) => o.id === osId);
  if (!os || os.estado !== "APROVADA") throw new OsNaoAgendavelError();
  return os;
}

/**
 * Encontra o slot cujo início bate exatamente com `inicioISO`, derivando o
 * técnico sugerido no servidor. O cliente nunca informa o técnico: ele só
 * escolhe o horário, e a OS herda o `tecnicoId` do slot correspondente.
 */
export function escolherSlot(
  slots: SlotDisponivel[],
  inicioISO: string,
): SlotDisponivel {
  const alvo = new Date(inicioISO).getTime();
  if (Number.isNaN(alvo)) throw new SlotNaoEncontradoError();
  const slot = slots.find((s) => s.inicio.getTime() === alvo);
  if (!slot) throw new SlotNaoEncontradoError();
  return slot;
}

/**
 * Colapsa múltiplos técnicos que oferecem o mesmo horário num único slot
 * sugerido (o primeiro, conforme a ordenação do motor). O cliente vê apenas
 * horários — nunca a lista de técnicos.
 */
export function slotsPorHorario(slots: SlotDisponivel[]): SlotDisponivel[] {
  const vistos = new Set<number>();
  const unicos: SlotDisponivel[] = [];
  for (const s of slots) {
    const t = s.inicio.getTime();
    if (vistos.has(t)) continue;
    vistos.add(t);
    unicos.push(s);
  }
  return unicos;
}
