import { describe, expect, it, vi } from "vitest";
import {
  dentroDaJanelaCliente,
  cancelarOsCliente,
  reagendarOsCliente,
  ForaDaJanelaError,
  OsInexistenteError,
} from "@/operacao/reagendamento";
import type { ReagendamentoRepo } from "@/operacao/reagendamento";
import { EstadoInvalidoError } from "@/operacao/orcamento-repo";

describe("dentroDaJanelaCliente", () => {
  it("retorna false quando faltam mais de 24h (ex: 25h de folga)", () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const agendadoPara = new Date("2026-06-02T13:00:00Z"); // 25h depois
    expect(dentroDaJanelaCliente(agendadoPara, agora)).toBe(false);
  });

  it("retorna true quando faltam menos ou exatamente 24h (ex: 23h de folga)", () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const agendadoPara = new Date("2026-06-02T11:00:00Z"); // 23h depois
    expect(dentroDaJanelaCliente(agendadoPara, agora)).toBe(true);
  });
});

describe("cancelarOsCliente", () => {
  const cliente = { whatsapp: "5511999999999" };
  const agora = new Date("2026-06-01T12:00:00Z");
  const dataAgendada = new Date("2026-06-02T13:00:00Z"); // 25h de folga

  function repoFake(over: Partial<ReagendamentoRepo> = {}): ReagendamentoRepo {
    return {
      carregar: vi.fn(async () => ({
        estado: "AGENDADA" as const,
        tecnicoId: "tec-1",
        agendadoPara: dataAgendada,
      })),
      cancelar: vi.fn(async () => {}),
      reagendar: vi.fn(async () => {}),
      cancelarParaAprovada: vi.fn(async () => {}),
      ...over,
    };
  }

  it("permite cancelar se for mais de 24h antes e chama repo.cancelarParaAprovada", async () => {
    const repo = repoFake();
    await cancelarOsCliente("os-1", cliente, repo, agora);

    expect(repo.cancelarParaAprovada).toHaveBeenCalledWith(
      "os-1",
      expect.objectContaining({
        estadoAnterior: "AGENDADA",
        estadoNovo: "APROVADA",
        atorEmail: "cliente:5511999999999",
        motivo: null,
        em: agora,
      }),
    );
  });

  it("bloqueia cancelamento se for menos de 24h antes", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "AGENDADA" as const,
        tecnicoId: "tec-1",
        agendadoPara: new Date("2026-06-02T11:00:00Z"), // 23h de folga
      })),
    });

    await expect(
      cancelarOsCliente("os-1", cliente, repo, agora),
    ).rejects.toBeInstanceOf(ForaDaJanelaError);
  });

  it("lança erro se a OS não existir", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => null),
    });

    await expect(
      cancelarOsCliente("os-not-found", cliente, repo, agora),
    ).rejects.toBeInstanceOf(OsInexistenteError);
  });

  it("bloqueia cancelamento se o estado da OS não for AGENDADA", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "EM_EXECUCAO" as const,
        tecnicoId: "tec-1",
        agendadoPara: dataAgendada,
      })),
    });

    await expect(
      cancelarOsCliente("os-1", cliente, repo, agora),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });
});

describe("reagendarOsCliente", () => {
  const cliente = { whatsapp: "5511999999999" };
  const agora = new Date("2026-06-01T12:00:00Z");
  const dataAgendada = new Date("2026-06-02T13:00:00Z"); // 25h de folga
  const novoSlot = new Date("2026-06-05T10:00:00Z");

  function repoFake(over: Partial<ReagendamentoRepo> = {}): ReagendamentoRepo {
    return {
      carregar: vi.fn(async () => ({
        estado: "AGENDADA" as const,
        tecnicoId: "tec-1",
        agendadoPara: dataAgendada,
      })),
      cancelar: vi.fn(async () => {}),
      reagendar: vi.fn(async () => {}),
      cancelarParaAprovada: vi.fn(async () => {}),
      ...over,
    };
  }

  it("permite reagendar se for mais de 24h antes e chama repo.reagendar", async () => {
    const repo = repoFake();
    await reagendarOsCliente("os-1", cliente, novoSlot, "tec-1", repo, agora);

    expect(repo.reagendar).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      expect.objectContaining({
        estadoAnterior: "AGENDADA",
        estadoNovo: "AGENDADA",
        atorEmail: "cliente:5511999999999",
        motivo: null,
        em: agora,
      }),
      "tec-1",
    );
  });

  it("bloqueia reagendamento se for menos de 24h antes", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "AGENDADA" as const,
        tecnicoId: "tec-1",
        agendadoPara: new Date("2026-06-02T11:00:00Z"), // 23h de folga
      })),
    });

    await expect(
      reagendarOsCliente("os-1", cliente, novoSlot, "tec-1", repo, agora),
    ).rejects.toBeInstanceOf(ForaDaJanelaError);
  });

  it("bloqueia reagendamento se o estado da OS não for AGENDADA", async () => {
    const repo = repoFake({
      carregar: vi.fn(async () => ({
        estado: "EM_EXECUCAO" as const,
        tecnicoId: "tec-1",
        agendadoPara: dataAgendada,
      })),
    });

    await expect(
      reagendarOsCliente("os-1", cliente, novoSlot, "tec-1", repo, agora),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });
});


