import { describe, expect, it } from "vitest";
import {
  validarOsAgendavel,
  escolherSlot,
  slotsPorHorario,
  OsNaoAgendavelError,
  SlotNaoEncontradoError,
} from "@/operacao/agendamento-cliente";
import type { SolicitacaoView, OsView } from "@/operacao/aprovacao-repo";
import type { SlotDisponivel } from "@/operacao/slots";

function os(parcial: Partial<OsView>): OsView {
  return {
    id: "os-1",
    categoria: "ELETRICA",
    estado: "APROVADA",
    agendadoPara: null,
    orcamento: null,
    tecnico: null,
    ...parcial,
  };
}

function view(ordens: OsView[]): SolicitacaoView {
  return {
    token: "tok",
    clienteNome: "Cliente",
    cidade: null,
    uf: null,
    criadoEm: new Date(),
    ordens,
  };
}

function slot(inicioISO: string, tecnicoId: string): SlotDisponivel {
  return { inicio: new Date(inicioISO), duracaoMin: 60, tecnicoId };
}

describe("validarOsAgendavel", () => {
  it("retorna a OS quando pertence ao token e está APROVADA", () => {
    const alvo = os({ id: "os-1", estado: "APROVADA" });
    expect(validarOsAgendavel(view([alvo]), "os-1")).toBe(alvo);
  });

  it("rejeita OS de outro token (não encontrada na view)", () => {
    expect(() => validarOsAgendavel(view([os({ id: "os-1" })]), "os-2")).toThrow(
      OsNaoAgendavelError,
    );
  });

  it("rejeita OS que não está APROVADA", () => {
    const ordem = os({ id: "os-1", estado: "ORCADA" });
    expect(() => validarOsAgendavel(view([ordem]), "os-1")).toThrow(
      OsNaoAgendavelError,
    );
  });
});

describe("escolherSlot", () => {
  const slots = [
    slot("2026-06-10T11:00:00.000Z", "tec-a"),
    slot("2026-06-10T12:00:00.000Z", "tec-b"),
  ];

  it("casa o horário e deriva o técnico sugerido", () => {
    const s = escolherSlot(slots, "2026-06-10T12:00:00.000Z");
    expect(s.tecnicoId).toBe("tec-b");
  });

  it("rejeita horário que não existe mais na lista", () => {
    expect(() => escolherSlot(slots, "2026-06-10T13:00:00.000Z")).toThrow(
      SlotNaoEncontradoError,
    );
  });

  it("rejeita ISO inválido", () => {
    expect(() => escolherSlot(slots, "nao-e-data")).toThrow(
      SlotNaoEncontradoError,
    );
  });
});

describe("slotsPorHorario", () => {
  it("colapsa técnicos distintos no mesmo horário mantendo o primeiro", () => {
    const slots = [
      slot("2026-06-10T11:00:00.000Z", "tec-a"),
      slot("2026-06-10T11:00:00.000Z", "tec-b"),
      slot("2026-06-10T12:00:00.000Z", "tec-c"),
    ];
    const unicos = slotsPorHorario(slots);
    expect(unicos).toHaveLength(2);
    expect(unicos[0].tecnicoId).toBe("tec-a");
    expect(unicos[1].tecnicoId).toBe("tec-c");
  });
});
