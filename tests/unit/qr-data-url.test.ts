import { describe, expect, it } from "vitest";
import { gerarQrDataUrl } from "@/lib/qr";

describe("gerarQrDataUrl", () => {
  it("gera um data URL PNG a partir de uma URL", async () => {
    const dataUrl = await gerarQrDataUrl("https://dbg.example/assinar/conforto");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    // payload base64 não-trivial (QR de fato codificado)
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});
