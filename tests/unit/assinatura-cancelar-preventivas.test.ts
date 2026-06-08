import { describe, expect, it } from "vitest";
import {
  cancelarPreventivasFuturas,
  type PreventivaRepo,
} from "@/assinatura/cancelar-preventivas-futuras";

/**
 * Fake em memória: guarda as preventivas AGENDADA da assinatura e registra os
 * cancelamentos (osId + motivo) aplicados.
 */
function fakeRepo(
  agendadas: { id: string; agendadoPara: Date | null }[],
) {
  const cancelados: { osId: string; motivo: string }[] = [];
  const repo: PreventivaRepo = {
    async listarAgendadasDaAssinatura() {
      return agendadas;
    },
    async cancelar(osId, motivo) {
      cancelados.push({ osId, motivo });
    },
  };
  return { repo, cancelados };
}

describe("cancelarPreventivasFuturas", () => {
  it("cancela preventiva agendada DEPOIS do fim do ciclo e mantém a de dentro", async () => {
    const fimCiclo = new Date("2026-06-28T00:00:00Z"); // +20 dias
    const { repo, cancelados } = fakeRepo([
      { id: "os-dentro", agendadoPara: new Date("2026-06-18T00:00:00Z") }, // +10d, dentro
      { id: "os-depois", agendadoPara: new Date("2026-07-08T00:00:00Z") }, // +30d, depois
    ]);

    const out = await cancelarPreventivasFuturas("ass-1", fimCiclo, repo);

    expect(out.canceladas).toEqual(["os-depois"]);
    expect(cancelados).toEqual([
      { osId: "os-depois", motivo: "assinatura encerrada" },
    ]);
  });

  it("mantém preventiva na fronteira exata (agendado_para == fim do ciclo)", async () => {
    const fimCiclo = new Date("2026-06-28T00:00:00Z");
    const { repo, cancelados } = fakeRepo([
      { id: "os-borda", agendadoPara: new Date("2026-06-28T00:00:00Z") },
    ]);

    const out = await cancelarPreventivasFuturas("ass-1", fimCiclo, repo);

    expect(out.canceladas).toEqual([]);
    expect(cancelados).toEqual([]);
  });

  it("ignora preventiva sem data de agendamento", async () => {
    const fimCiclo = new Date("2026-06-28T00:00:00Z");
    const { repo, cancelados } = fakeRepo([
      { id: "os-sem-data", agendadoPara: null },
    ]);

    const out = await cancelarPreventivasFuturas("ass-1", fimCiclo, repo);

    expect(out.canceladas).toEqual([]);
    expect(cancelados).toEqual([]);
  });
});
