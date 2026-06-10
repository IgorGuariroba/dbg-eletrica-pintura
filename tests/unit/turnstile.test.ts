import { describe, expect, it, vi } from "vitest";
import { verificarTurnstile } from "@/lib/turnstile";

function fetchFake(body: unknown) {
  return vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
}

describe("verificarTurnstile", () => {
  it("permite quando TURNSTILE_SECRET_KEY não está configurada (dev/test)", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const r = await verificarTurnstile("qualquer", { secret: undefined, fetchFn });
    expect(r.valido).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("com secret, valida o token no siteverify e aceita success=true", async () => {
    const fetchFn = fetchFake({ success: true });
    const r = await verificarTurnstile("tok-ok", {
      secret: "s3gr3do",
      ip: "1.2.3.4",
      fetchFn,
    });
    expect(r.valido).toBe(true);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    const corpo = init?.body as URLSearchParams;
    expect(corpo.get("secret")).toBe("s3gr3do");
    expect(corpo.get("response")).toBe("tok-ok");
    expect(corpo.get("remoteip")).toBe("1.2.3.4");
  });

  it("com secret, rejeita success=false", async () => {
    const r = await verificarTurnstile("tok-ruim", {
      secret: "s3gr3do",
      fetchFn: fetchFake({ success: false }),
    });
    expect(r.valido).toBe(false);
  });

  it("com secret, rejeita token ausente sem chamar a API", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const r = await verificarTurnstile(null, { secret: "s3gr3do", fetchFn });
    expect(r.valido).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fail-open: siteverify fora do ar não bloqueia o formulário", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("rede fora");
    }) as unknown as typeof fetch;
    const r = await verificarTurnstile("tok", { secret: "s3gr3do", fetchFn });
    expect(r.valido).toBe(true);
  });
});
