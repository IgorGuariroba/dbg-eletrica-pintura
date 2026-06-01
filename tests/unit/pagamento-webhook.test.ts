import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validarAssinatura } from "@/pagamento/webhook";

const SECRET = "test_webhook_secret_dev";

/**
 * Reproduz o manifest que o Mercado Pago assina:
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
function assinar(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("validarAssinatura", () => {
  it("aceita assinatura HMAC válida no esquema oficial do Mercado Pago", () => {
    const dataId = "123456";
    const requestId = "req-abc";
    const ts = "1700000000";
    const xSignature = assinar(dataId, requestId, ts);

    const ok = validarAssinatura({
      dataId,
      requestId,
      xSignature,
      secret: SECRET,
    });

    expect(ok).toBe(true);
  });

  it("rejeita assinatura com v1 adulterado", () => {
    const xSignature = "ts=1700000000,v1=deadbeefdeadbeefdeadbeefdeadbeef";
    const ok = validarAssinatura({
      dataId: "123456",
      requestId: "req-abc",
      xSignature,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejeita assinatura sem ts ou v1", () => {
    const ok = validarAssinatura({
      dataId: "123456",
      requestId: "req-abc",
      xSignature: "ts=1700000000",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rejeita assinatura calculada com segredo diferente", () => {
    const ts = "1700000000";
    const manifest = `id:123456;request-id:req-abc;ts:${ts};`;
    const v1 = createHmac("sha256", "outro_segredo")
      .update(manifest)
      .digest("hex");
    const ok = validarAssinatura({
      dataId: "123456",
      requestId: "req-abc",
      xSignature: `ts=${ts},v1=${v1}`,
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });
});
