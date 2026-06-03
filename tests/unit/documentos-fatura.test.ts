import { describe, expect, it } from "vitest";
import { gerarFaturaPdf, type FaturaView } from "@/documentos/fatura";

function faturaView(over: Partial<FaturaView> = {}): FaturaView {
  return {
    numeroOS: "A1B2C3D4",
    clienteNome: "Maria Silva",
    endereco: "Rua Teste, 100 - Centro, São Paulo - SP",
    tecnicoNome: "João Técnico",
    data: "03/06/2026",
    formaPagamento: "Pix",
    identificador: "manual",
    itens: [
      { descricao: "Instalação de tomada", quantidade: "2", precoUnitario: "50.00", subtotal: "100.00" },
    ],
    totalDeslocamento: "20.00",
    total: "120.00",
    ...over,
  };
}

describe("gerarFaturaPdf", () => {
  it("renderiza um Buffer de PDF parseável (assinatura %PDF-)", async () => {
    const buf = await gerarFaturaPdf(faturaView());

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("embute 'Fatura' no título dos metadados", async () => {
    const buf = await gerarFaturaPdf(faturaView());

    expect(buf.toString("latin1")).toContain("/Title");
    expect(buf.toString("latin1")).toContain("Fatura");
  });
});
