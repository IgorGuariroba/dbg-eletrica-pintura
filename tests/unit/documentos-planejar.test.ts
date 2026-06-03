import { describe, expect, it } from "vitest";
import { planejarDocumentos } from "@/documentos/planejar-documentos";

describe("planejarDocumentos", () => {
  it("OS paga (NORMAL/EXPRESS/COMPLEMENTAR) no PAGA gera fatura + certificado", () => {
    for (const tipo of ["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const) {
      expect(planejarDocumentos(tipo, "PAGA")).toEqual({
        fatura: true,
        certificado: true,
      });
    }
  });

  it("GARANTIA no CONCLUIDA gera só certificado (sem fatura)", () => {
    expect(planejarDocumentos("GARANTIA", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: true,
    });
  });

  it("PREVENTIVA nunca gera certificado", () => {
    expect(planejarDocumentos("PREVENTIVA", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: false,
    });
    expect(planejarDocumentos("PREVENTIVA", "PAGA")).toEqual({
      fatura: false,
      certificado: false,
    });
  });

  it("OS paga no CONCLUIDA ainda não gera documentos (saem no PAGA)", () => {
    expect(planejarDocumentos("NORMAL", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: false,
    });
  });

  it("estado sem documentos (ex.: ORCADA) não gera nada", () => {
    expect(planejarDocumentos("NORMAL", "ORCADA")).toEqual({
      fatura: false,
      certificado: false,
    });
  });
});
