import { describe, expect, it, vi } from "vitest";
import { cancelarOsTecnico, reagendarOsTecnico } from "@/operacao/reagendamento";
import type { ReagendamentoRepo } from "@/operacao/reagendamento";
import {
  CancelamentoEmExecucaoError,
  MotivoObrigatorioError,
} from "@/operacao/reagendamento";
import {
  NaoAtribuidoError,
  EstadoInvalidoError,
} from "@/operacao/orcamento-repo";

function repoFake(over: Partial<ReagendamentoRepo> = {}): ReagendamentoRepo {
  return {
    carregar: vi.fn(async () => ({
      estado: "AGENDADA" as const,
      tecnicoId: "tec-1",
      agendadoPara: new Date("2026-06-01T10:00:00Z"),
    })),
    cancelar: vi.fn(async () => {}),
    reagendar: vi.fn(async () => {}),
    cancelarParaAprovada: vi.fn(async () => {}),
    ...over,
  };
}

const tecnico = { membroId: "tec-1", email: "tec@dbg.com" };

describe("cancelarOsTecnico", () => {
  it("não permite cancelar OS EM_EXECUÇÃO", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "EM_EXECUCAO" as const,
        tecnicoId: "tec-1",
        agendadoPara: null,
      })),
    });
    await expect(
      cancelarOsTecnico("os-1", tecnico, "motivo bem grande aqui", repo),
    ).rejects.toBeInstanceOf(CancelamentoEmExecucaoError);
  });

  it("exige motivo com pelo menos 10 caracteres", async () => {
    await expect(
      cancelarOsTecnico("os-1", tecnico, "curto", repoFake()),
    ).rejects.toBeInstanceOf(MotivoObrigatorioError);
  });

  it("só o técnico atribuído pode cancelar", async () => {
    await expect(
      cancelarOsTecnico(
        "os-1",
        { membroId: "outro-tec", email: "outro@dbg.com" },
        "motivo bem grande aqui",
        repoFake(),
      ),
    ).rejects.toBeInstanceOf(NaoAtribuidoError);
  });

  it("devolve à fila como AGENDADA quando já havia agendamento", async () => {
    const repo = repoFake();
    await cancelarOsTecnico("os-1", tecnico, "cliente remarcou para a semana que vem", repo);
    expect(repo.cancelar).toHaveBeenCalledWith(
      "os-1",
      "AGENDADA",
      expect.objectContaining({
        estadoAnterior: "AGENDADA",
        estadoNovo: "AGENDADA",
        atorEmail: "tec@dbg.com",
        motivo: "cliente remarcou para a semana que vem",
      }),
    );
  });

  it("volta para ORÇADA quando não havia agendamento", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "APROVADA" as const,
        tecnicoId: "tec-1",
        agendadoPara: null,
      })),
    });
    await cancelarOsTecnico("os-1", tecnico, "não consigo atender este endereço", repo);
    expect(repo.cancelar).toHaveBeenCalledWith(
      "os-1",
      "ORCADA",
      expect.objectContaining({ estadoAnterior: "APROVADA", estadoNovo: "ORCADA" }),
    );
  });
});

describe("reagendarOsTecnico", () => {
  const novoSlot = new Date("2026-06-05T14:00:00Z");

  it("reagenda livremente quando AGENDADA, sem exigir motivo", async () => {
    const repo = repoFake();
    await reagendarOsTecnico("os-1", tecnico, novoSlot, null, repo);
    expect(repo.reagendar).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      expect.objectContaining({ estadoNovo: "AGENDADA", atorEmail: "tec@dbg.com" }),
    );
  });

  it("exige motivo ao reagendar depois de A_CAMINHO", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "A_CAMINHO" as const,
        tecnicoId: "tec-1",
        agendadoPara: new Date("2026-06-01T10:00:00Z"),
      })),
    });
    await expect(
      reagendarOsTecnico("os-1", tecnico, novoSlot, null, repo),
    ).rejects.toBeInstanceOf(MotivoObrigatorioError);
  });

  it("rejeita reagendar a partir de estado não permitido", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "EM_EXECUCAO" as const,
        tecnicoId: "tec-1",
        agendadoPara: null,
      })),
    });
    await expect(
      reagendarOsTecnico("os-1", tecnico, novoSlot, "motivo bem grande aqui", repo),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });
});
