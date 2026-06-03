import { describe, expect, it } from "vitest";
import { renderizarEmailDocumentos } from "@/notificacao/email-service";

describe("renderizarEmailDocumentos", () => {
  it("escapa o nome do cliente (sem injeção de HTML)", async () => {
    const html = await renderizarEmailDocumentos({
      clienteNome: '<img src=x onerror="alert(1)">',
      numeroOS: "A1B2C3D4",
      urlPortal: "https://dbg.test/s/tok",
      faturaUrl: "https://r2/fatura.pdf",
      certificadoUrl: null,
    });

    // O payload cru não pode aparecer; deve estar escapado.
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).toContain("&lt;img");
  });

  it("inclui só os links de documentos disponíveis", async () => {
    const html = await renderizarEmailDocumentos({
      clienteNome: "Maria",
      numeroOS: "A1B2C3D4",
      urlPortal: "https://dbg.test/s/tok",
      faturaUrl: "https://r2/fatura.pdf",
      certificadoUrl: null,
    });

    expect(html).toContain("https://r2/fatura.pdf");
    expect(html).not.toContain("certificado");
    expect(html).toContain("A1B2C3D4");
  });
});
