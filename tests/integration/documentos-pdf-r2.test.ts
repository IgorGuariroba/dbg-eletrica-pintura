import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { salvarPDFR2 } from "@/documentos/pdf/salvar-pdf-r2";
import { obterUrlLeituraAssinada } from "@/lib/storage";

// Round-trip real contra o R2 privado. Inerte sem credenciais (CI padrão).
const hasR2 = Boolean(
  process.env.R2_PRIVATE_BUCKET &&
    process.env.R2_PRIVATE_ACCESS_KEY_ID &&
    process.env.R2_PRIVATE_SECRET_ACCESS_KEY &&
    process.env.R2_PRIVATE_ACCOUNT_ID,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!hasR2)("salvarPDFR2 contra R2 real", () => {
  it("a URL assinada é acessível dentro do prazo (HTTP 200)", async () => {
    const chave = `documentos/_teste/${randomUUID()}.pdf`;
    const buf = Buffer.from("%PDF-1.7\n% teste salvarPDFR2\n");

    const url = await salvarPDFR2(buf, chave);
    const res = await fetch(url);

    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  }, 30_000);

  it("a URL assinada carrega a expiração fixa do módulo (teto SigV4 de 7 dias)", async () => {
    const chave = `documentos/_teste/${randomUUID()}.pdf`;
    await salvarPDFR2(Buffer.from("%PDF-1.7\n"), chave);

    // Expiração é decisão do módulo Storage — caller não passa expiry (#166).
    const url = await obterUrlLeituraAssinada(chave);
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe(
      String(7 * 24 * 60 * 60),
    );
  }, 30_000);
});
