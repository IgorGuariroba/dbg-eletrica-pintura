import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { salvarPDFR2 } from "@/documentos/pdf/salvar-pdf-r2";
import { obterUrlLeituraAssinada } from "@/operacao/r2-privado";

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

  it("a URL fica inacessível após expirar (HTTP 403)", async () => {
    const chave = `documentos/_teste/${randomUUID()}.pdf`;
    await salvarPDFR2(Buffer.from("%PDF-1.7\n"), chave);

    const urlCurta = await obterUrlLeituraAssinada(chave, 1);
    await sleep(3000);
    const res = await fetch(urlCurta);

    expect(res.status).toBe(403);
  }, 30_000);
});
