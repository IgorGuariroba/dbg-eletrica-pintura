import { describe, expect, it } from "vitest";
import { calcularSlotsDisponiveis } from "@/operacao/slots";
import type { TecnicoAgendavel } from "@/operacao/slots";
import type { HorarioComercial } from "@/operacao/horario-comercial";

describe("calcularSlotsDisponiveis - Ciclo 1 (Tracer Bullet)", () => {
  it("gera 10 slots de 60min para seg 8h-18h com técnico disponível no horário comercial", () => {
    // 2026-06-01 é uma segunda-feira.
    // Usamos datas locais/timezone da máquina para consistência no teste.
    const inicio = new Date("2026-06-01T00:00:00");
    const fim = new Date("2026-06-01T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-1",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "18:00" },
        },
        ocupacoes: [],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    expect(slots).toHaveLength(10);
    
    // O primeiro slot deve começar às 08:00
    expect(slots[0]).toEqual({
      inicio: new Date("2026-06-01T08:00:00"),
      duracaoMin: 60,
      tecnicoId: "tec-1",
    });

    // O último slot deve começar às 17:00 e terminar às 18:00 (dentro do horário comercial)
    expect(slots[9]).toEqual({
      inicio: new Date("2026-06-01T17:00:00"),
      duracaoMin: 60,
      tecnicoId: "tec-1",
    });
  });

  it("não gera slots para técnicos sem especialidade da categoria solicitada", () => {
    const inicio = new Date("2026-06-01T00:00:00");
    const fim = new Date("2026-06-01T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-eletrica",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "18:00" },
        },
        ocupacoes: [],
      },
      {
        id: "tec-pintura",
        especialidades: ["PINTURA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "18:00" },
        },
        ocupacoes: [],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    // Apenas tec-eletrica deve ter slots
    const tecnicosComSlots = new Set(slots.map(s => s.tecnicoId));
    expect(tecnicosComSlots.has("tec-eletrica")).toBe(true);
    expect(tecnicosComSlots.has("tec-pintura")).toBe(false);
  });

  it("estreita a janela de slots de acordo com a disponibilidade individual do técnico (interseção)", () => {
    const inicio = new Date("2026-06-01T00:00:00");
    const fim = new Date("2026-06-01T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-1",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "09:00", fim: "17:00" }, // Estreita comercial de 8-18
        },
        ocupacoes: [],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    // Deve gerar slots das 9h às 16h (8 slots de 60min)
    expect(slots).toHaveLength(8);
    expect(slots[0].inicio).toEqual(new Date("2026-06-01T09:00:00"));
    expect(slots[7].inicio).toEqual(new Date("2026-06-01T16:00:00"));
  });

  it("não gera slots para dias fechados no horário comercial ou indisponibilidade do técnico", () => {
    // 2026-06-07 é um domingo
    const inicio = new Date("2026-06-07T00:00:00");
    const fim = new Date("2026-06-07T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      dom: null, // Domingo fechado
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-1",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          dom: { inicio: "08:00", fim: "18:00" }, // técnico estaria disponível, mas empresa está fechada
          seg: { inicio: "08:00", fim: "18:00" },
        },
        ocupacoes: [],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    expect(slots).toHaveLength(0);
  });

  it("remove slots que colidem com ocupações existentes do técnico", () => {
    const inicio = new Date("2026-06-01T00:00:00");
    const fim = new Date("2026-06-01T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-1",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "18:00" },
        },
        // Ocupado das 10:00 às 11:00 (assumindo duração padrão do slot)
        ocupacoes: [new Date("2026-06-01T10:00:00")],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    // Em vez de 10 slots, deve retornar 9, e não deve conter o slot das 10:00
    expect(slots).toHaveLength(9);
    const contemSlot10h = slots.some(s => s.inicio.getTime() === new Date("2026-06-01T10:00:00").getTime());
    expect(contemSlot10h).toBe(false);
  });

  it("retorna slots ordenados cronologicamente por início quando há múltiplos técnicos", () => {
    const inicio = new Date("2026-06-01T00:00:00");
    const fim = new Date("2026-06-01T23:59:59");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "10:00" }, // Janela pequena para manter o teste curto (2 slots por técnico)
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-b",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "10:00" },
        },
        ocupacoes: [],
      },
      {
        id: "tec-a",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "10:00" },
        },
        ocupacoes: [],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    // Deve gerar 4 slots no total: 2 para cada técnico
    expect(slots).toHaveLength(4);
    
    // A ordenação deve ser estritamente cronológica por início.
    // Slots de 08:00 de ambos os técnicos devem vir antes dos slots de 09:00.
    expect(slots[0].inicio).toEqual(new Date("2026-06-01T08:00:00"));
    expect(slots[1].inicio).toEqual(new Date("2026-06-01T08:00:00"));
    expect(slots[2].inicio).toEqual(new Date("2026-06-01T09:00:00"));
    expect(slots[3].inicio).toEqual(new Date("2026-06-01T09:00:00"));
  });
});
