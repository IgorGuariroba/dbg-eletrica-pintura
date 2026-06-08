import { describe, expect, it, vi } from "vitest";
import { criarAgendamentoService, OsNaoAgendavelError, SlotIndisponivelError, ForaDaJanelaError, NaoAtribuidoError, MotivoObrigatorioError } from "@/operacao/agendamento";
import type { AgendamentoRepo, AgendamentoDadosOs } from "@/operacao/agendamento-repo";
import type { TecnicoAgendavel } from "@/operacao/slots";
import type { HorarioComercial } from "@/operacao/horario-comercial";

function criarFakeRepo(overrides: Partial<AgendamentoRepo> = {}): AgendamentoRepo {
  return {
    buscarOs: vi.fn(),
    buscarOsComToken: vi.fn(async (token, osId) => {
      if (token === "tok-valid" && osId === "os-1") {
        return {
          id: "os-1",
          estado: "APROVADA",
          categoria: "ELETRICA",
          tecnicoId: null,
          agendadoPara: null,
          clienteAssinante: false,
          clienteWhatsapp: "5511999999999",
        } as AgendamentoDadosOs;
      }
      return null;
    }),
    listarTecnicosAgendaveis: vi.fn(async () => {
      return [
        {
          id: "tec-1",
          especialidades: ["ELETRICA"],
          disponibilidade: {
            seg: { inicio: "08:00", fim: "10:00" },
          },
          ocupacoes: [],
        },
      ] as TecnicoAgendavel[];
    }),
    obterHorarioComercial: vi.fn(async () => {
      return {
        seg: { inicio: "08:00", fim: "18:00" },
      } as HorarioComercial;
    }),
    salvarAgendamento: vi.fn(),
    liberarAgendamento: vi.fn(),
    ...overrides,
  };
}

describe("AgendamentoService - obterSlotsCliente", () => {
  it("Caso 1 (RED): retorna slots cronologicamente ordenados e sem duplicados para OS APROVADA", async () => {
    // Definimos uma data de referência (segunda-feira 01/06/2026 às 00:00 UTC)
    // Para simplificar a verificação, usaremos data fixa nos testes.
    const repo = criarFakeRepo();
    const service = criarAgendamentoService(repo);

    // Mockamos a data atual como segunda-feira 2026-06-01T00:00:00.000Z
    const mockAgora = new Date("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockAgora);

    const slots = await service.obterSlotsCliente("tok-valid", "os-1");

    expect(slots).toBeInstanceOf(Array);
    expect(slots.length).toBeGreaterThan(0);
    // Primeiro slot deve bater com a interseção (08:00 SP = 11:00 UTC)
    expect(slots[0].inicio.toISOString()).toBe("2026-06-01T11:00:00.000Z");
    expect(slots[0].prioridade).toBeUndefined();

    vi.useRealTimers();
  });

  it("Caso 2 (GREEN): ativa a flag prioridade nos slots calculados para assinante", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async (token, osId) => {
        if (token === "tok-valid" && osId === "os-1") {
          return {
            id: "os-1",
            estado: "APROVADA",
            categoria: "ELETRICA",
            tecnicoId: null,
            agendadoPara: null,
            clienteAssinante: true, // Assinante ativo!
            clienteWhatsapp: "5511999999999",
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    const mockAgora = new Date("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockAgora);

    const slots = await service.obterSlotsCliente("tok-valid", "os-1");

    expect(slots).toBeInstanceOf(Array);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].prioridade).toBe(true);

    vi.useRealTimers();
  });
});

describe("AgendamentoService - agendarCliente", () => {
  it("Caso 3 (RED): realiza o agendamento associando o primeiro técnico livre, atualizando a OS e registrando transição", async () => {
    const repo = criarFakeRepo();
    const service = criarAgendamentoService(repo);

    const mockAgora = new Date("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockAgora);

    // Horário escolhido: segunda 11:00 UTC (08:00 SP, que bate com a janela comercial + técnico)
    const slotData = new Date("2026-06-01T11:00:00.000Z");

    await service.agendarCliente("tok-valid", "os-1", slotData);

    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      slotData,
      "tec-1",
      expect.objectContaining({
        estadoAnterior: "APROVADA",
        estadoNovo: "AGENDADA",
        atorEmail: "cliente:tok-valid",
        motivo: null,
        em: mockAgora,
      })
    );

    vi.useRealTimers();
  });

  it("Caso 4 (GREEN): propaga SlotIndisponivelError se o repositório acusar colisão de horário", async () => {
    const slotData = new Date("2026-06-01T11:00:00.000Z");
    const repo = criarFakeRepo({
      salvarAgendamento: vi.fn(async () => {
        throw new SlotIndisponivelError("tec-1", slotData);
      }),
    });
    const service = criarAgendamentoService(repo);

    const mockAgora = new Date("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockAgora);

    await expect(
      service.agendarCliente("tok-valid", "os-1", slotData)
    ).rejects.toThrow(SlotIndisponivelError);

    vi.useRealTimers();
  });
});

describe("AgendamentoService - cancelarCliente", () => {
  it("Caso 5 (RED): impede o cancelamento se for menos de 24h antes", async () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const dataAgendada = new Date("2026-06-02T11:00:00Z"); // 23h de folga (dentro das 24h)

    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async (token, osId) => {
        if (token === "tok-valid" && osId === "os-1") {
          return {
            id: "os-1",
            estado: "AGENDADA",
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: dataAgendada,
            clienteAssinante: false,
            clienteWhatsapp: "5511999999999",
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await expect(
      service.cancelarCliente("tok-valid", "os-1", "5511999999999")
    ).rejects.toThrow(ForaDaJanelaError);

    vi.useRealTimers();
  });

  it("Caso 6 (GREEN): permite cancelar se for mais de 24h antes e chama repo.liberarAgendamento", async () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const dataAgendada = new Date("2026-06-02T13:00:00Z"); // 25h de folga (fora das 24h)

    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async (token, osId) => {
        if (token === "tok-valid" && osId === "os-1") {
          return {
            id: "os-1",
            estado: "AGENDADA",
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: dataAgendada,
            clienteAssinante: false,
            clienteWhatsapp: "5511999999999",
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await service.cancelarCliente("tok-valid", "os-1", "5511999999999");

    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "APROVADA",
      expect.objectContaining({
        estadoAnterior: "AGENDADA",
        estadoNovo: "APROVADA",
        atorEmail: "cliente:5511999999999",
        motivo: null,
        em: agora,
      })
    );

    vi.useRealTimers();
  });
});

describe("AgendamentoService - reagendarTecnico", () => {
  it("Caso 7 (RED): exige técnico correspondente e motivo descritivo se a OS estiver em trânsito (A_CAMINHO/NO_LOCAL)", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async (osId) => {
        if (osId === "os-1") {
          return {
            id: "os-1",
            estado: "A_CAMINHO",
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: new Date("2026-06-01T11:00:00Z"),
            clienteAssinante: false,
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    // 1. Testa bloqueio se o técnico não for o atribuído
    await expect(
      service.reagendarTecnico("os-1", "tec-other", "tecnico@dbg.com.br", new Date(), "Motivo com mais de 10 caracteres")
    ).rejects.toThrow(NaoAtribuidoError);

    // 2. Testa bloqueio se a OS exige motivo mas ele é curto ou nulo
    await expect(
      service.reagendarTecnico("os-1", "tec-1", "tecnico@dbg.com.br", new Date(), "Curto")
    ).rejects.toThrow(MotivoObrigatorioError);

    // 3. Testa sucesso se todas as invariantes baterem
    const novoSlot = new Date("2026-06-05T10:00:00Z");
    const motivoValido = "Cliente solicitou remarcação por imprevisto familiar";
    const agora = new Date("2026-06-01T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await service.reagendarTecnico("os-1", "tec-1", "tecnico@dbg.com.br", novoSlot, motivoValido);

    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      "tec-1",
      expect.objectContaining({
        estadoAnterior: "A_CAMINHO",
        estadoNovo: "AGENDADA",
        atorEmail: "tecnico@dbg.com.br",
        motivo: motivoValido,
        em: agora,
      })
    );

    vi.useRealTimers();
  });
});

describe("AgendamentoService - Admin Operations", () => {
  it("Caso 8 (RED): permite reagendar e cancelar de forma soberana", async () => {
    const dataAgendada = new Date("2026-06-01T11:00:00Z");
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async (osId) => {
        if (osId === "os-1") {
          return {
            id: "os-1",
            estado: "EM_EXECUCAO", // Admin pode reagendar mesmo se estiver em execução!
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: dataAgendada,
            clienteAssinante: false,
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    const novoSlot = new Date("2026-06-02T10:00:00Z");
    const agora = new Date("2026-06-01T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(agora);

    // 1. Admin Reagendar
    await service.reagendarAdmin("os-1", "admin@dbg.com.br", novoSlot, "tec-2");
    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      "tec-2",
      expect.objectContaining({
        estadoAnterior: "EM_EXECUCAO",
        estadoNovo: "AGENDADA",
        atorEmail: "admin@dbg.com.br",
        motivo: "Reagendamento administrativo",
        em: agora,
      })
    );

    // 2. Admin Cancelar
    await service.cancelarAdmin("os-1", "admin@dbg.com.br", "Cancelamento em lote");
    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "APROVADA",
      expect.objectContaining({
        estadoAnterior: "EM_EXECUCAO",
        estadoNovo: "APROVADA",
        atorEmail: "admin@dbg.com.br",
        motivo: "Cancelamento em lote",
        em: agora,
      })
    );

    vi.useRealTimers();
  });
});

describe("AgendamentoService - reagendarCliente", () => {
  it("Caso 9: permite reagendar se a OS estiver AGENDADA e estiver fora da janela de 24h", async () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const dataAgendada = new Date("2026-06-02T13:00:00Z"); // 25h
    const novoSlot = new Date("2026-06-08T11:00:00.000Z"); // Segunda-feira às 11:00 UTC (08:00 SP)

    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async (token, osId) => {
        if (token === "tok-valid" && osId === "os-1") {
          return {
            id: "os-1",
            estado: "AGENDADA",
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: dataAgendada,
            clienteAssinante: false,
            clienteWhatsapp: "5511999999999",
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await service.reagendarCliente("tok-valid", "os-1", "5511999999999", novoSlot);

    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      "tec-1",
      expect.objectContaining({
        estadoAnterior: "AGENDADA",
        estadoNovo: "AGENDADA",
        atorEmail: "cliente:5511999999999",
        motivo: null,
        em: agora,
      })
    );

    vi.useRealTimers();
  });

  it("Caso 10: lança ForaDaJanelaError se o reagendamento for solicitado com menos de 24h restantes", async () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const dataAgendada = new Date("2026-06-02T11:00:00Z"); // 23h
    const novoSlot = new Date("2026-06-08T11:00:00.000Z");

    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async (token, osId) => {
        if (token === "tok-valid" && osId === "os-1") {
          return {
            id: "os-1",
            estado: "AGENDADA",
            categoria: "ELETRICA",
            tecnicoId: "tec-1",
            agendadoPara: dataAgendada,
            clienteAssinante: false,
            clienteWhatsapp: "5511999999999",
          } as AgendamentoDadosOs;
        }
        return null;
      }),
    });
    const service = criarAgendamentoService(repo);

    vi.useFakeTimers();
    vi.setSystemTime(agora);

    await expect(
      service.reagendarCliente("tok-valid", "os-1", "5511999999999", novoSlot)
    ).rejects.toThrow(ForaDaJanelaError);

    vi.useRealTimers();
  });
});
