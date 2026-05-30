import { describe, expect, it } from "vitest";
import { montarLinkWhatsApp } from "@/lib/whatsapp";

describe("montarLinkWhatsApp", () => {
  it("monta a URL wa.me com o telefone só com dígitos", () => {
    const url = montarLinkWhatsApp({
      whatsapp: "+55 (11) 99999-1234",
      texto: "oi",
    });
    expect(url.startsWith("https://wa.me/5511999991234?text=")).toBe(true);
  });

  it("codifica o texto da mensagem", () => {
    const url = montarLinkWhatsApp({
      whatsapp: "5511999991234",
      texto: "Olá, João & Maria",
    });
    expect(url).toContain("text=Ol%C3%A1%2C%20Jo%C3%A3o%20%26%20Maria");
  });
});
