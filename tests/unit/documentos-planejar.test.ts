import { describe, expect, it } from "vitest";
import { planejarDocumentos } from "@/documentos/planejar-documentos";

describe("planejarDocumentos", () => {
  it("OS paga (NORMAL/EXPRESS/COMPLEMENTAR) no PAGA gera fatura + certificado", () => {
    for (const tipo of ["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const) {
      expect(planejarDocumentos(tipo, "PAGA")).toEqual({
        fatura: true,
        certificado: true,
        relatorio: false,
      });
    }
  });

  it("GARANTIA no CONCLUIDA gera só certificado (sem fatura)", () => {
    expect(planejarDocumentos("GARANTIA", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: true,
      relatorio: false,
    });
  });

  it("PREVENTIVA nunca gera certificado", () => {
    expect(planejarDocumentos("PREVENTIVA", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: false,
      relatorio: true,
    });
    expect(planejarDocumentos("PREVENTIVA", "PAGA")).toEqual({
      fatura: false,
      certificado: false,
      relatorio: false,
    });
  });

  it("OS paga no CONCLUIDA ainda não gera documentos (saem no PAGA)", () => {
    expect(planejarDocumentos("NORMAL", "CONCLUIDA")).toEqual({
      fatura: false,
      certificado: false,
      relatorio: false,
    });
  });

  it("estado sem documentos (ex.: ORCADA) não gera nada", () => {
    expect(planejarDocumentos("NORMAL", "ORCADA")).toEqual({
      fatura: false,
      certificado: false,
      relatorio: false,
    });
  });

  it("PREVENTIVA no CONCLUIDA gera relatório (e nada mais)", () => {
    expect(planejarDocumentos("PREVENTIVA", "CONCLUIDA")).toMatchObject({
      relatorio: true,
      fatura: false,
      certificado: false,
    });
  });

  it("relatório só sai na PREVENTIVA concluída, não em outros tipos/estados", () => {
    expect(planejarDocumentos("PREVENTIVA", "EM_EXECUCAO").relatorio).toBe(false);
    expect(planejarDocumentos("NORMAL", "CONCLUIDA").relatorio).toBe(false);
    expect(planejarDocumentos("GARANTIA", "CONCLUIDA").relatorio).toBe(false);
  });
});
