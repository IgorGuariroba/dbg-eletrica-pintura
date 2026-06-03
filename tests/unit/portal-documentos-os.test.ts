import { describe, expect, it, vi } from "vitest";
import { montarDocumentosPortalOs } from "@/portal/historico";

function porTipo(views: { tipo: string; estado: string; url: string | null }[]) {
  return Object.fromEntries(views.map((v) => [v.tipo, v]));
}

describe("montarDocumentosPortalOs", () => {
  it("OS paga (PAGA): fatura e certificado disponíveis com URL assinada", async () => {
    const urlAssinada = vi.fn(async (chave: string) => `https://r2/${chave}`);

    const views = await montarDocumentosPortalOs({
      osId: "os-1",
      tipo: "NORMAL",
      estado: "PAGA",
      urlAssinada,
    });
    const por = porTipo(views);

    expect(por.FATURA.estado).toBe("DISPONIVEL");
    expect(por.FATURA.url).toBe("https://r2/fatura/os/os-1.pdf");
    expect(por.CERTIFICADO_GARANTIA.estado).toBe("DISPONIVEL");
    expect(por.CERTIFICADO_GARANTIA.url).toBe("https://r2/garantia/os/os-1.pdf");
  });

  it("OS concluída ainda não paga: documentos em breve, sem assinar URL", async () => {
    const urlAssinada = vi.fn(async (c: string) => `https://r2/${c}`);

    const views = await montarDocumentosPortalOs({
      osId: "os-2",
      tipo: "NORMAL",
      estado: "CONCLUIDA",
      urlAssinada,
    });
    const por = porTipo(views);

    expect(por.FATURA.estado).toBe("EM_BREVE");
    expect(por.FATURA.url).toBeNull();
    expect(por.CERTIFICADO_GARANTIA.estado).toBe("EM_BREVE");
    expect(urlAssinada).not.toHaveBeenCalled();
  });

  it("GARANTIA concluída: só certificado disponível (sem fatura)", async () => {
    const urlAssinada = vi.fn(async (c: string) => `https://r2/${c}`);

    const views = await montarDocumentosPortalOs({
      osId: "os-3",
      tipo: "GARANTIA",
      estado: "CONCLUIDA",
      urlAssinada,
    });
    const por = porTipo(views);

    expect(por.FATURA.estado).toBe("EM_BREVE");
    expect(por.CERTIFICADO_GARANTIA.estado).toBe("DISPONIVEL");
    expect(por.CERTIFICADO_GARANTIA.url).toBe("https://r2/garantia/os/os-3.pdf");
  });
});
