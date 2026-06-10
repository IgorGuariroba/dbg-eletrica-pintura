import { beforeAll, describe, expect, it } from "vitest";
import { uploadServiceSolicitacaoR2 } from "@/operacao/r2-privado";

const MB = 1024 * 1024;

describe("presign de foto de solicitação (bucket privado)", () => {
  beforeAll(() => {
    process.env.R2_PRIVATE_ACCOUNT_ID ??= "conta-teste";
    process.env.R2_PRIVATE_ACCESS_KEY_ID ??= "chave-teste";
    process.env.R2_PRIVATE_SECRET_ACCESS_KEY ??= "segredo-teste";
    process.env.R2_PRIVATE_BUCKET ??= "bucket-teste";
  });

  it("rejeita contentLength acima de 10MB", async () => {
    const svc = uploadServiceSolicitacaoR2();
    await expect(
      svc.assinarUploadFoto({
        filename: "foto.jpg",
        contentType: "image/jpeg",
        contentLength: 10 * MB + 1,
      }),
    ).rejects.toThrow(/10\s?MB/i);
  });

  it("rejeita contentLength ausente, zero, negativo ou fracionário", async () => {
    const svc = uploadServiceSolicitacaoR2();
    for (const contentLength of [0, -1, 1.5, Number.NaN]) {
      await expect(
        svc.assinarUploadFoto({
          filename: "foto.jpg",
          contentType: "image/jpeg",
          contentLength,
        }),
      ).rejects.toThrow(/10\s?MB/i);
    }
  });

  it("assina content-length na URL (PUT só aceita o tamanho exato)", async () => {
    const svc = uploadServiceSolicitacaoR2();
    const { uploadUrl, key } = await svc.assinarUploadFoto({
      filename: "foto.png",
      contentType: "image/png",
      contentLength: 2 * MB,
    });
    expect(key).toMatch(/^solicitacoes\/[a-z0-9-]+\.png$/);
    const url = new URL(uploadUrl);
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders.split(";")).toContain("content-length");
  });
});
