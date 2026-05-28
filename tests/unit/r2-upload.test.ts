import { describe, expect, it, vi } from "vitest";
import { criarUploadService } from "@/catalogo/r2-upload";

describe("R2 upload service", () => {
  it("gera key única com prefixo + extensão preservada", async () => {
    const presigner = vi.fn(async () => "https://signed.example/put");
    const svc = criarUploadService({
      bucket: "dbg-public",
      baseUrl: "https://pub.r2.dev",
      presignedPut: presigner,
    });

    const out = await svc.assinarUploadFoto({
      filename: "Tomada.JPG",
      contentType: "image/jpeg",
    });

    expect(out.uploadUrl).toBe("https://signed.example/put");
    expect(out.publicUrl).toMatch(
      /^https:\/\/pub\.r2\.dev\/servicos\/[a-z0-9-]+\.jpg$/,
    );
    expect(presigner).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "dbg-public",
        contentType: "image/jpeg",
        key: expect.stringMatching(/^servicos\/[a-z0-9-]+\.jpg$/),
      }),
    );
  });

  it("rejeita contentType não-imagem", async () => {
    const svc = criarUploadService({
      bucket: "x",
      baseUrl: "https://x",
      presignedPut: vi.fn(),
    });
    await expect(
      svc.assinarUploadFoto({ filename: "a.exe", contentType: "application/octet-stream" }),
    ).rejects.toThrow(/imagem/i);
  });

  it("rejeita SVG (vetor de XSS em bucket público)", async () => {
    const svc = criarUploadService({
      bucket: "x",
      baseUrl: "https://x",
      presignedPut: vi.fn(),
    });
    await expect(
      svc.assinarUploadFoto({ filename: "a.svg", contentType: "image/svg+xml" }),
    ).rejects.toThrow(/imagem/i);
  });

  it("usa extensão do allowlist mesmo se filename mente", async () => {
    const presigner = vi.fn(async () => "https://signed");
    const svc = criarUploadService({
      bucket: "b",
      baseUrl: "https://x",
      presignedPut: presigner,
    });
    const out = await svc.assinarUploadFoto({
      filename: "evil.svg",
      contentType: "image/png",
    });
    expect(out.publicUrl).toMatch(/\.png$/);
  });

  it("respeita keyPrefix customizado", async () => {
    const presigner = vi.fn(async () => "https://signed");
    const svc = criarUploadService({
      bucket: "b",
      baseUrl: "https://x",
      presignedPut: presigner,
      keyPrefix: "membros",
    });
    const out = await svc.assinarUploadFoto({
      filename: "a.png",
      contentType: "image/png",
    });
    expect(out.key).toMatch(/^membros\//);
    expect(out.publicUrl).toMatch(/\/membros\/[a-z0-9-]+\.png$/);
  });
});
