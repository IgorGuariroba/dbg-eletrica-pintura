import { describe, expect, it } from "vitest";
import { calcularSlotsDisponiveis } from "@/operacao/slots";
import type { TecnicoAgendavel } from "@/operacao/slots";
import type { HorarioComercial } from "@/operacao/horario-comercial";

describe("calcularSlotsDisponiveis - Ciclo 1 (Tracer Bullet)", () => {
  it("gera 10 slots de 60min para seg 8h-18h com técnico disponível no horário comercial (UTC)", () => {
    // 2026-06-01 é uma segunda-feira.
    // Usamos datas UTC explicitamente com "Z"
    const inicio = new Date("2026-06-01T00:00:00Z");
    const fim = new Date("2026-06-01T23:59:59Z");
    
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
    
    // O primeiro slot deve começar às 08:00 UTC
    expect(slots[0]).toEqual({
      inicio: new Date("2026-06-01T08:00:00Z"),
      duracaoMin: 60,
      tecnicoId: "tec-1",
    });

    // O último slot deve começar às 17:00 UTC e terminar às 18:00 UTC
    expect(slots[9]).toEqual({
      inicio: new Date("2026-06-01T17:00:00Z"),
      duracaoMin: 60,
      tecnicoId: "tec-1",
    });
  });

  it("não gera slots para técnicos sem especialidade da categoria solicitada", () => {
    const inicio = new Date("2026-06-01T00:00:00Z");
    const fim = new Date("2026-06-01T23:59:59Z");
    
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

    const tecnicosComSlots = new Set(slots.map(s => s.tecnicoId));
    expect(tecnicosComSlots.has("tec-eletrica")).toBe(true);
    expect(tecnicosComSlots.has("tec-pintura")).toBe(false);
  });

  it("estreita a janela de slots de acordo com a disponibilidade individual do técnico (interseção em UTC)", () => {
    const inicio = new Date("2026-06-01T00:00:00Z");
    const fim = new Date("2026-06-01T23:59:59Z");
    
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

    // Deve gerar slots das 9h às 16h UTC (8 slots de 60min)
    expect(slots).toHaveLength(8);
    expect(slots[0].inicio).toEqual(new Date("2026-06-01T09:00:00Z"));
    expect(slots[7].inicio).toEqual(new Date("2026-06-01T16:00:00Z"));
  });

  it("não gera slots para dias fechados no horário comercial ou indisponibilidade do técnico", () => {
    // 2026-06-07 é um domingo em UTC
    const inicio = new Date("2026-06-07T00:00:00Z");
    const fim = new Date("2026-06-07T23:59:59Z");
    
    const horarioComercial: HorarioComercial = {
      dom: null, // Domingo fechado
      seg: { inicio: "08:00", fim: "18:00" },
    };

    const tecnicos: TecnicoAgendavel[] = [
      {
        id: "tec-1",
        especialidades: ["ELETRICA"],
        disponibilidade: {
          dom: { inicio: "08:00", fim: "18:00" },
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
    const inicio = new Date("2026-06-01T00:00:00Z");
    const fim = new Date("2026-06-01T23:59:59Z");
    
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
        // Ocupado das 10:00 às 11:00 UTC
        ocupacoes: [new Date("2026-06-01T10:00:00Z")],
      },
    ];

    const slots = calcularSlotsDisponiveis({
      inicio,
      fim,
      categoria: "ELETRICA",
      horarioComercial,
      tecnicos,
    });

    // Em vez de 10 slots, deve retornar 9, e não deve conter o slot das 10:00 UTC
    expect(slots).toHaveLength(9);
    const contemSlot10h = slots.some(s => s.inicio.getTime() === new Date("2026-06-01T10:00:00Z").getTime());
    expect(contemSlot10h).toBe(false);
  });

  it("retorna slots ordenados cronologicamente por início quando há múltiplos técnicos", () => {
    const inicio = new Date("2026-06-01T00:00:00Z");
    const fim = new Date("2026-06-01T23:59:59Z");
    
    const horarioComercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "10:00" }, // Janela pequena (2 slots por técnico)
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

    expect(slots).toHaveLength(4);
    
    // A ordenação deve ser estritamente cronológica por início.
    expect(slots[0].inicio).toEqual(new Date("2026-06-01T08:00:00Z"));
    expect(slots[1].inicio).toEqual(new Date("2026-06-01T08:00:00Z"));
    expect(slots[2].inicio).toEqual(new Date("2026-06-01T09:00:00Z"));
    expect(slots[3].inicio).toEqual(new Date("2026-06-01T09:00:00Z"));
  });
});
