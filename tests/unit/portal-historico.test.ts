import { describe, expect, it } from "vitest";
import { montarFotosOs, montarDocumentosPortal } from "@/portal/historico";
import { destinoPortal } from "@/portal/destino";

describe("portal histórico", () => {
  it("montarFotosOs converte chaves antes/depois em URLs assinadas", async () => {
    const chamadas: string[] = [];
    const fotos = await montarFotosOs("os-1", {
      async listarChaves(osId, tipo) {
        chamadas.push(`${osId}:${tipo}`);
        return tipo === "ANTES" ? ["antes-1", "antes-2"] : ["depois-1"];
      },
      async urlLeitura(chave) {
        return `https://privado.test/${chave}`;
      },
    });

    expect(chamadas).toEqual(["os-1:ANTES", "os-1:DEPOIS"]);
    expect(fotos).toEqual({
      antes: ["https://privado.test/antes-1", "https://privado.test/antes-2"],
      depois: ["https://privado.test/depois-1"],
    });
  });

  it("destinoPortal escolhe redirects por sessão", () => {
    expect(destinoPortal(null)).toBe("/login");
    expect(destinoPortal({ user: { role: "membro_interno", whatsapp: "5511" } })).toBe("/painel");
    expect(destinoPortal({ user: { role: "admin_raiz", whatsapp: "5511" } })).toBe("/painel");
    expect(destinoPortal({ user: { role: "cliente", whatsapp: null } })).toBe("/portal/vincular");
    expect(destinoPortal({ user: { role: "cliente", whatsapp: "5511" } })).toBeNull();
  });

  it("montarDocumentosPortal mantém documentos futuros inativos quando não há chave", () => {
    expect(montarDocumentosPortal({ faturaKey: null, certificadoKey: null })).toEqual([
      { tipo: "FATURA", rotulo: "Fatura", estado: "EM_BREVE", tooltip: "em breve", url: null },
      { tipo: "CERTIFICADO_GARANTIA", rotulo: "Certificado de garantia", estado: "EM_BREVE", tooltip: "em breve", url: null },
      { tipo: "ACIONAR_GARANTIA", rotulo: "Acionar garantia", estado: "EM_BREVE", tooltip: "em breve", url: null },
      { tipo: "INDICACAO", rotulo: "Link de indicação", estado: "EM_BREVE", tooltip: "em breve", url: null },
    ]);
  });
});
