import { describe, expect, it } from "vitest";
import {
  montarDadosCertificado,
  type CertificadoInput,
} from "@/documentos/dados-certificado";

function input(over: Partial<CertificadoInput> = {}): CertificadoInput {
  return {
    osId: "a1b2c3d4-0000-0000-0000-000000000000",
    clienteNome: "Maria Silva",
    servicos: ["Instalação elétrica", "Troca de disjuntor"],
    prazoGarantiaMeses: 12,
    inicio: new Date("2026-06-03T12:00:00Z"),
    fim: new Date("2027-06-03T12:00:00Z"),
    ...over,
  };
}

describe("montarDadosCertificado", () => {
  it("formata as datas de início e fim da garantia em pt-BR", () => {
    const view = montarDadosCertificado(input());
    expect(view.dataInicio).toBe("03/06/2026");
    expect(view.dataFim).toBe("03/06/2027");
  });

  it("preserva número da OS, prazo e serviços executados", () => {
    const view = montarDadosCertificado(input());
    expect(view.numeroOS).toBe("A1B2C3D4");
    expect(view.prazoGarantiaMeses).toBe(12);
    expect(view.servicos).toEqual(["Instalação elétrica", "Troca de disjuntor"]);
  });
});
