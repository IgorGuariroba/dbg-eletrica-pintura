import { createElement } from "react";
import { Document, Page, Text } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { gerarPDF } from "@/documentos/pdf/gerar-pdf";

function docMinimo() {
  return createElement(
    Document,
    null,
    createElement(Page, null, createElement(Text, null, "conteúdo")),
  );
}

describe("gerarPDF", () => {
  it("retorna um Buffer de PDF parseável (assinatura %PDF-)", async () => {
    const buf = await gerarPDF(docMinimo(), { titulo: "Teste" });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("embute o título nos metadados do PDF", async () => {
    const buf = await gerarPDF(docMinimo(), { titulo: "Fatura DBG" });

    const conteudo = buf.toString("latin1");
    expect(conteudo).toContain("/Title");
    expect(conteudo).toContain("Fatura DBG");
  });
});
