import { describe, expect, it } from "vitest";
import { agruparPorDiaSP } from "@/lib/agrupar-por-dia";

describe("agruparPorDiaSP", () => {
  it("agrupa pelo dia no fuso de São Paulo, não pelo dia UTC", () => {
    // 02/06 02:59 UTC ainda é 01/06 23:59 em SP; 03:01 UTC já é 02/06 00:01 SP.
    const itens = [
      { inicioISO: "2026-06-02T02:59:00.000Z" },
      { inicioISO: "2026-06-02T03:01:00.000Z" },
    ];

    const grupos = agruparPorDiaSP(itens, (s) => s.inicioISO);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].itens).toEqual([{ inicioISO: "2026-06-02T02:59:00.000Z" }]);
    expect(grupos[1].itens).toEqual([{ inicioISO: "2026-06-02T03:01:00.000Z" }]);
  });

  it("ordena grupos cronologicamente mesmo com entrada desordenada e aceita Date", () => {
    const itens = [
      { agendadoPara: new Date("2026-06-10T11:00:00Z"), osId: "c" },
      { agendadoPara: new Date("2026-06-08T11:00:00Z"), osId: "a" },
      { agendadoPara: new Date("2026-06-08T14:00:00Z"), osId: "b" },
    ];

    const grupos = agruparPorDiaSP(itens, (i) => i.agendadoPara);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].itens.map((i) => i.osId)).toEqual(["a", "b"]);
    expect(grupos[1].itens.map((i) => i.osId)).toEqual(["c"]);
    expect(grupos[0].data.toISOString()).toBe("2026-06-08T11:00:00.000Z");
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(agruparPorDiaSP([], () => new Date())).toEqual([]);
  });
});
