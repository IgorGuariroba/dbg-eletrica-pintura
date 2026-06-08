/** Motivo carimbado no cancelamento de preventivas por encerramento de assinatura. */
export const MOTIVO_ASSINATURA_ENCERRADA = "assinatura encerrada";

export interface PreventivaRepo {
  /** OS Preventiva AGENDADA vinculadas à assinatura (qualquer data). */
  listarAgendadasDaAssinatura(
    assinaturaId: string,
  ): Promise<{ id: string; agendadoPara: Date | null }[]>;
  /** Move a OS para CANCELADA, registrando o motivo e o instante. */
  cancelar(osId: string, motivo: string, agora: Date): Promise<void>;
}

/**
 * Cancela as preventivas agendadas para DEPOIS do fim do ciclo pago — as de
 * dentro do ciclo acontecem normalmente. A fronteira (`agendado_para > fimCiclo`)
 * fica no domínio (testável sem SQL); o repo só lista as AGENDADA da assinatura.
 */
export async function cancelarPreventivasFuturas(
  assinaturaId: string,
  fimCiclo: Date,
  repo: PreventivaRepo,
  agora: Date = new Date(),
): Promise<{ canceladas: string[] }> {
  const agendadas = await repo.listarAgendadasDaAssinatura(assinaturaId);
  const canceladas: string[] = [];
  for (const os of agendadas) {
    if (os.agendadoPara && os.agendadoPara.getTime() > fimCiclo.getTime()) {
      await repo.cancelar(os.id, MOTIVO_ASSINATURA_ENCERRADA, agora);
      canceladas.push(os.id);
    }
  }
  return { canceladas };
}
