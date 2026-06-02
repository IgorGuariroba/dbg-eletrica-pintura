import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validarAssinatura } from "@/notificacao/whatsapp-webhook";

const SECRET = "app-secret-teste";

function assinar(payload: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("validarAssinatura (webhook WhatsApp)", () => {
  it("aceita payload com assinatura X-Hub-Signature-256 correta", () => {
    const payload = JSON.stringify({ entry: [{ id: "WABA" }] });
    const ok = validarAssinatura({
      payload,
      assinatura: assinar(payload),
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("rejeita payload adulterado", () => {
    const payload = JSON.stringify({ entry: [{ id: "WABA" }] });
    const assinatura = assinar(payload);
    const adulterado = payload.replace("WABA", "HACKED");
    const ok = validarAssinatura({
      payload: adulterado,
      assinatura,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejeita assinatura malformada", () => {
    const payload = "{}";
    expect(
      validarAssinatura({ payload, assinatura: "lixo", secret: SECRET }),
    ).toBe(false);
  });
});
