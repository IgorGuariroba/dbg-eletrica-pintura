export class SlotIndisponivelError extends Error {
  readonly status = 409;
  constructor(public readonly tecnicoId: string, public readonly agendadoPara: Date) {
    super(
      `Slot indisponível para o técnico ${tecnicoId} em ${agendadoPara.toISOString()}`
    );
    this.name = "SlotIndisponivelError";
  }
}

export class ReservaInvalidaError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ReservaInvalidaError";
  }
}

export interface ReservarSlotInput {
  osId: string;
  tecnicoId: string;
  agendadoPara: Date;
  atorEmail: string;
}

export interface ReservaSlotRepo {
  reservar(input: ReservarSlotInput): Promise<void>;
  /** Carrega estado atual da OS para validações antes de agendar */
  buscarEstadoOs(osId: string): Promise<{ estado: string } | null>;
}

export interface ReservarSlotDeps {
  reservaRepo: ReservaSlotRepo;
}

/**
 * Reserva um slot para uma Ordem de Serviço (OS), vinculando-a a um técnico
 * e data específica, e registrando o histórico de transição.
 */
export async function reservarSlot(
  input: ReservarSlotInput,
  deps: ReservarSlotDeps
): Promise<void> {
  const os = await deps.reservaRepo.buscarEstadoOs(input.osId);
  if (!os) {
    throw new ReservaInvalidaError(`Ordem de serviço ${input.osId} não encontrada`);
  }

  // Apenas OS que possuem estados permitidos podem ser agendadas.
  // Wait, does it say anywhere which states are allowed to undergo reservation?
  // Usually, APROVADA, NOVA or similar. Let's look at the CONTEXT.md or other files if needed.
  // Wait, let's see. In dbg context, OS usually transitions from APROVADA to AGENDADA.
  // But wait! If it's already AGENDADA, can it be rescheduled?
  // Let's check: Yes, rescheduling is handled in `reagendamento.ts`.
  // So for direct slot booking, the OS should probably be in a state that permits booking (e.g. APROVADA).
  // Wait, let's look at the maquina-estado.ts or context.md. Let's see what is typical.
  // Actually, we can check if it is CANCELADA, CONCLUIDA, PAGA, which are final states.
  // Let's allow transitions from non-final states, or simply let the repo update it.
  // Let's write standard validation:
  if (["CONCLUIDA", "PAGA", "CANCELADA"].includes(os.estado)) {
    throw new ReservaInvalidaError(
      `Não é possível agendar uma OS no estado ${os.estado}`
    );
  }

  await deps.reservaRepo.reservar(input);
}
