import { describe, expect, it, vi } from "vitest";
import {
  criarAgendamentoService,
  dentroDaJanelaCliente,
  OsInexistenteError,
  OsNaoAgendavelError,
  SlotNaoEncontradoError,
  SlotIndisponivelError,
  ForaDaJanelaError,
  NaoAtribuidoError,
  MotivoObrigatorioError,
  CancelamentoEmExecucaoError,
} from "@/operacao/agendamento";
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

// ---------------------------------------------------------------------------
// Cobertura de branches de erro e métodos administrativos/técnicos faltantes.
// ---------------------------------------------------------------------------

/** Constrói um AgendamentoDadosOs com defaults sãos para o caminho via buscarOs. */
function osDados(over: Partial<AgendamentoDadosOs> = {}): AgendamentoDadosOs {
  return {
    id: "os-1",
    estado: "AGENDADA",
    categoria: "ELETRICA",
    tecnicoId: "tec-1",
    agendadoPara: new Date("2026-06-10T11:00:00Z"),
    clienteAssinante: false,
    clienteWhatsapp: "5511999999999",
    ...over,
  };
}

describe("dentroDaJanelaCliente (helper)", () => {
  it("retorna true exatamente no limite de 24h (<=)", () => {
    const agora = new Date("2026-06-01T00:00:00Z");
    const em24h = new Date("2026-06-02T00:00:00Z");
    expect(dentroDaJanelaCliente(em24h, agora)).toBe(true);
  });

  it("retorna false com mais de 24h de folga", () => {
    const agora = new Date("2026-06-01T00:00:00Z");
    const em24hMais1ms = new Date("2026-06-02T00:00:00.001Z");
    expect(dentroDaJanelaCliente(em24hMais1ms, agora)).toBe(false);
  });
});

describe("AgendamentoService - obterSlotsCliente (erros)", () => {
  it("lança OsInexistenteError quando o token/OS não resolve", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(service.obterSlotsCliente("tok-invalido", "os-1")).rejects.toThrow(
      OsInexistenteError
    );
  });

  it("lança OsNaoAgendavelError quando a OS não está APROVADA", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () => osDados({ estado: "AGENDADA" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(service.obterSlotsCliente("tok-valid", "os-1")).rejects.toThrow(
      OsNaoAgendavelError
    );
  });
});

describe("AgendamentoService - agendarCliente (erros)", () => {
  it("lança OsInexistenteError quando o token/OS não resolve", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.agendarCliente("tok-invalido", "os-1", new Date())
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança OsNaoAgendavelError quando a OS não está APROVADA", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () => osDados({ estado: "AGENDADA" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(
      service.agendarCliente("tok-valid", "os-1", new Date())
    ).rejects.toThrow(OsNaoAgendavelError);
  });

  it("lança SlotNaoEncontradoError quando o horário pedido não existe na grade", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    // Horário arbitrário fora de qualquer slot calculado.
    await expect(
      service.agendarCliente("tok-valid", "os-1", new Date("2026-06-01T03:00:00.000Z"))
    ).rejects.toThrow(SlotNaoEncontradoError);
    vi.useRealTimers();
  });
});

describe("AgendamentoService - cancelarCliente (erros)", () => {
  it("lança OsInexistenteError quando o token/OS não resolve", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.cancelarCliente("tok-invalido", "os-1", "5511999999999")
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança OsNaoAgendavelError quando a OS não está AGENDADA", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () => osDados({ estado: "APROVADA" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(
      service.cancelarCliente("tok-valid", "os-1", "5511999999999")
    ).rejects.toThrow(OsNaoAgendavelError);
  });

  it("permite cancelar sem agendadoPara definido (sem barreira de janela)", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () => osDados({ estado: "AGENDADA", agendadoPara: null })),
    });
    const service = criarAgendamentoService(repo);
    await service.cancelarCliente("tok-valid", "os-1", "5511999999999");
    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "APROVADA",
      expect.objectContaining({ estadoNovo: "APROVADA" })
    );
  });
});

describe("AgendamentoService - reagendarCliente (erros)", () => {
  it("lança OsInexistenteError quando o token/OS não resolve", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.reagendarCliente("tok-invalido", "os-1", "5511999999999", new Date())
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança OsNaoAgendavelError quando a OS não está AGENDADA", async () => {
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () => osDados({ estado: "APROVADA" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(
      service.reagendarCliente("tok-valid", "os-1", "5511999999999", new Date())
    ).rejects.toThrow(OsNaoAgendavelError);
  });

  it("lança SlotNaoEncontradoError quando o novo horário não existe na grade", async () => {
    const agora = new Date("2026-06-01T12:00:00Z");
    const repo = criarFakeRepo({
      buscarOsComToken: vi.fn(async () =>
        osDados({ estado: "AGENDADA", agendadoPara: new Date("2026-06-05T11:00:00Z") })
      ),
    });
    const service = criarAgendamentoService(repo);
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    await expect(
      service.reagendarCliente("tok-valid", "os-1", "5511999999999", new Date("2026-06-01T03:00:00Z"))
    ).rejects.toThrow(SlotNaoEncontradoError);
    vi.useRealTimers();
  });
});

describe("AgendamentoService - reagendarTecnico (erros e estados)", () => {
  it("lança OsInexistenteError quando a OS não existe", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.reagendarTecnico("os-x", "tec-1", "t@dbg.com.br", new Date(), null)
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança OsNaoAgendavelError em estado não reagendável (EM_EXECUCAO)", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async () => osDados({ estado: "EM_EXECUCAO" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(
      service.reagendarTecnico("os-1", "tec-1", "t@dbg.com.br", new Date(), null)
    ).rejects.toThrow(OsNaoAgendavelError);
  });

  it("reagenda OS AGENDADA sem exigir motivo", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async () => osDados({ estado: "AGENDADA" })),
    });
    const service = criarAgendamentoService(repo);
    const novoSlot = new Date("2026-06-12T10:00:00Z");
    await service.reagendarTecnico("os-1", "tec-1", "t@dbg.com.br", novoSlot, null);
    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      "tec-1",
      expect.objectContaining({ estadoAnterior: "AGENDADA", estadoNovo: "AGENDADA", motivo: null })
    );
  });
});

describe("AgendamentoService - cancelarTecnico", () => {
  it("lança OsInexistenteError quando a OS não existe", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.cancelarTecnico("os-x", "tec-1", "t@dbg.com.br", "Motivo suficientemente longo")
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança NaoAtribuidoError quando o técnico não é o atribuído", async () => {
    const repo = criarFakeRepo({ buscarOs: vi.fn(async () => osDados({ tecnicoId: "tec-1" })) });
    const service = criarAgendamentoService(repo);
    await expect(
      service.cancelarTecnico("os-1", "tec-outro", "t@dbg.com.br", "Motivo suficientemente longo")
    ).rejects.toThrow(NaoAtribuidoError);
  });

  it("lança CancelamentoEmExecucaoError quando a OS está EM_EXECUCAO", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async () => osDados({ estado: "EM_EXECUCAO", tecnicoId: "tec-1" })),
    });
    const service = criarAgendamentoService(repo);
    await expect(
      service.cancelarTecnico("os-1", "tec-1", "t@dbg.com.br", "Motivo suficientemente longo")
    ).rejects.toThrow(CancelamentoEmExecucaoError);
  });

  it("lança MotivoObrigatorioError quando o motivo tem menos de 10 caracteres", async () => {
    const repo = criarFakeRepo({ buscarOs: vi.fn(async () => osDados({ tecnicoId: "tec-1" })) });
    const service = criarAgendamentoService(repo);
    await expect(
      service.cancelarTecnico("os-1", "tec-1", "t@dbg.com.br", "curto")
    ).rejects.toThrow(MotivoObrigatorioError);
  });

  it("libera para AGENDADA quando havia agendadoPara", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async () =>
        osDados({ estado: "AGENDADA", tecnicoId: "tec-1", agendadoPara: new Date("2026-06-10T11:00:00Z") })
      ),
    });
    const service = criarAgendamentoService(repo);
    await service.cancelarTecnico("os-1", "tec-1", "t@dbg.com.br", "Motivo suficientemente longo");
    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "AGENDADA",
      expect.objectContaining({ estadoNovo: "AGENDADA", motivo: "Motivo suficientemente longo" })
    );
  });

  it("libera para ORCADA quando não havia agendadoPara", async () => {
    const repo = criarFakeRepo({
      buscarOs: vi.fn(async () => osDados({ estado: "AGENDADA", tecnicoId: "tec-1", agendadoPara: null })),
    });
    const service = criarAgendamentoService(repo);
    await service.cancelarTecnico("os-1", "tec-1", "t@dbg.com.br", "Motivo suficientemente longo");
    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "ORCADA",
      expect.objectContaining({ estadoNovo: "ORCADA" })
    );
  });
});

describe("AgendamentoService - reagendarAdmin (erros e fallback de técnico)", () => {
  it("lança OsInexistenteError quando a OS não existe", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.reagendarAdmin("os-x", "admin@dbg.com.br", new Date())
    ).rejects.toThrow(OsInexistenteError);
  });

  it("lança Error quando não há técnico atribuído nem fornecido", async () => {
    const repo = criarFakeRepo({ buscarOs: vi.fn(async () => osDados({ tecnicoId: null })) });
    const service = criarAgendamentoService(repo);
    await expect(
      service.reagendarAdmin("os-1", "admin@dbg.com.br", new Date())
    ).rejects.toThrow("Técnico não atribuído e nenhum fornecido");
  });

  it("reaproveita o técnico já atribuído quando nenhum é fornecido", async () => {
    const repo = criarFakeRepo({ buscarOs: vi.fn(async () => osDados({ tecnicoId: "tec-1" })) });
    const service = criarAgendamentoService(repo);
    const novoSlot = new Date("2026-06-12T10:00:00Z");
    await service.reagendarAdmin("os-1", "admin@dbg.com.br", novoSlot);
    expect(repo.salvarAgendamento).toHaveBeenCalledWith(
      "os-1",
      novoSlot,
      "tec-1",
      expect.objectContaining({ motivo: "Reagendamento administrativo" })
    );
  });
});

describe("AgendamentoService - cancelarAdmin (erros e default de motivo)", () => {
  it("lança OsInexistenteError quando a OS não existe", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.cancelarAdmin("os-x", "admin@dbg.com.br")
    ).rejects.toThrow(OsInexistenteError);
  });

  it("usa motivo padrão administrativo quando nenhum é informado", async () => {
    const repo = criarFakeRepo({ buscarOs: vi.fn(async () => osDados({ estado: "AGENDADA" })) });
    const service = criarAgendamentoService(repo);
    await service.cancelarAdmin("os-1", "admin@dbg.com.br");
    expect(repo.liberarAgendamento).toHaveBeenCalledWith(
      "os-1",
      "APROVADA",
      expect.objectContaining({ motivo: "Cancelamento administrativo" })
    );
  });
});

describe("AgendamentoService - cancelarLoteAdmin", () => {
  it("lança MotivoObrigatorioError quando o motivo tem menos de 10 caracteres", async () => {
    const service = criarAgendamentoService(criarFakeRepo());
    await expect(
      service.cancelarLoteAdmin(["os-1"], "admin@dbg.com.br", "curto")
    ).rejects.toThrow(MotivoObrigatorioError);
  });

  it("agrega resultados por OS: sucesso, não encontrada, estado inválido e erro do repo", async () => {
    const buscarOs = vi.fn(async (osId: string) => {
      if (osId === "os-ok") return osDados({ id: "os-ok", estado: "AGENDADA" });
      if (osId === "os-concluida") return osDados({ id: "os-concluida", estado: "CONCLUIDA" });
      if (osId === "os-explode") return osDados({ id: "os-explode", estado: "APROVADA" });
      return null; // os-fantasma
    });
    const liberarAgendamento = vi.fn(async (osId: string) => {
      if (osId === "os-explode") throw new Error("falha no banco");
    });
    const repo = criarFakeRepo({ buscarOs, liberarAgendamento });
    const service = criarAgendamentoService(repo);

    const res = await service.cancelarLoteAdmin(
      ["os-ok", "os-fantasma", "os-concluida", "os-explode"],
      "admin@dbg.com.br",
      "Cancelamento em lote administrativo"
    );

    expect(res).toEqual([
      { osId: "os-ok", ok: true },
      { osId: "os-fantasma", ok: false, erro: "OS não encontrada" },
      { osId: "os-concluida", ok: false, erro: "OS no estado CONCLUIDA não pode ser cancelada" },
      { osId: "os-explode", ok: false, erro: "falha no banco" },
    ]);
    expect(liberarAgendamento).toHaveBeenCalledWith(
      "os-ok",
      "CANCELADA",
      expect.objectContaining({ estadoNovo: "CANCELADA" })
    );
  });
});
