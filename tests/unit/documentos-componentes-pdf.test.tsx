import { describe, expect, it } from "vitest";
import { gerarPDF } from "@/documentos/pdf/gerar-pdf";
import {
  PDFLayout,
  PDFSection,
  PDFTable,
} from "@/documentos/pdf/componentes";

describe("componentes PDF", () => {
  it("renderiza PDFLayout + PDFSection + PDFTable num PDF válido", async () => {
    const doc = (
      <PDFLayout>
        <PDFSection titulo="Itens">
          <PDFTable
            colunas={["Serviço", "Valor"]}
            linhas={[
              ["Troca de tomada", "R$ 80,00"],
              ["Pintura de parede", "R$ 350,00"],
            ]}
          />
        </PDFSection>
      </PDFLayout>
    );

    const buf = await gerarPDF(doc, { titulo: "Documento" });

    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // logo embutido + conteúdo => PDF não-trivial
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("rejeita PDFTable com linha de aridade diferente das colunas", () => {
    expect(() =>
      PDFTable({ colunas: ["A", "B"], linhas: [["só uma"]] }),
    ).toThrow();
  });
});
