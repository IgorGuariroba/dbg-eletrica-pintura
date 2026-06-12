import { describe, expect, it, vi } from "vitest";
import {
  salvarPDFR2,
  type ArmazenamentoPdf,
} from "@/documentos/pdf/salvar-pdf-r2";

function armazenamento(): ArmazenamentoPdf {
  return {
    enviar: vi.fn(async () => {}),
    urlAssinada: vi.fn(async () => "https://r2.exemplo/assinada"),
  };
}

describe("salvarPDFR2", () => {
  it("envia o buffer na chave e retorna a URL assinada", async () => {
    const arm = armazenamento();
    const buf = Buffer.from("%PDF-1.7 fake");

    const url = await salvarPDFR2(buf, "documentos/os/1/fatura.pdf", arm);

    expect(arm.enviar).toHaveBeenCalledWith("documentos/os/1/fatura.pdf", buf);
    expect(url).toBe("https://r2.exemplo/assinada");
  });

  it("pede a URL assinada ao armazenamento (expiração é decisão dele)", async () => {
    const arm = armazenamento();

    await salvarPDFR2(Buffer.from("x"), "documentos/c.pdf", arm);

    expect(arm.urlAssinada).toHaveBeenCalledWith("documentos/c.pdf");
  });
});
