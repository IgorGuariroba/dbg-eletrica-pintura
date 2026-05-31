import { describe, expect, it } from "vitest";
import {
  disponibilidadeDentroDoComercial,
  type HorarioComercial,
  validarHorarioComercial,
} from "@/operacao/horario-comercial";

describe("disponibilidadeDentroDoComercial", () => {
  it("aceita janela do técnico contida no horário comercial do dia", () => {
    const comercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };
    const disponibilidade = {
      seg: { inicio: "09:00", fim: "12:00" },
    };

    expect(disponibilidadeDentroDoComercial(disponibilidade, comercial)).toEqual(
      [],
    );
  });

  it("acusa o dia quando o técnico começa antes da abertura comercial", () => {
    const comercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };
    const disponibilidade = {
      seg: { inicio: "07:00", fim: "12:00" },
    };

    expect(
      disponibilidadeDentroDoComercial(disponibilidade, comercial),
    ).toEqual(["seg"]);
  });

  it("acusa o dia quando o técnico termina depois do fechamento comercial", () => {
    const comercial: HorarioComercial = {
      seg: { inicio: "08:00", fim: "18:00" },
    };
    const disponibilidade = {
      seg: { inicio: "09:00", fim: "20:00" },
    };

    expect(
      disponibilidadeDentroDoComercial(disponibilidade, comercial),
    ).toEqual(["seg"]);
  });

  it("acusa o dia em que a empresa está fechada mas o técnico marcou janela", () => {
    const comercial: HorarioComercial = { seg: null };
    const disponibilidade = {
      seg: { inicio: "09:00", fim: "12:00" },
    };

    expect(
      disponibilidadeDentroDoComercial(disponibilidade, comercial),
    ).toEqual(["seg"]);
  });
});

describe("validarHorarioComercial", () => {
  it("devolve a config tipada para uma janela válida", () => {
    expect(
      validarHorarioComercial({ seg: { inicio: "08:00", fim: "18:00" } }),
    ).toEqual({ seg: { inicio: "08:00", fim: "18:00" } });
  });

  it("rejeita janela com início igual ou posterior ao fim", () => {
    expect(() =>
      validarHorarioComercial({ seg: { inicio: "18:00", fim: "08:00" } }),
    ).toThrow();
  });
});
