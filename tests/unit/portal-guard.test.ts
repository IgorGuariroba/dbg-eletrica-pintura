import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// redirect() do Next lança internamente (NEXT_REDIRECT) para interromper o
// fluxo; o fake reproduz isso para que o guard não caia no `return` seguinte.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("exigirPortal guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para /login quando não há sessão", async () => {
    const { auth } = await import("@/auth");
    const { exigirPortal } = await import("@/portal/guard");

    vi.mocked(auth).mockResolvedValueOnce(null as any);

    await expect(exigirPortal()).rejects.toThrow("REDIRECT:/login");
  });

  it("redireciona para /painel quando o usuário não é cliente", async () => {
    const { auth } = await import("@/auth");
    const { exigirPortal } = await import("@/portal/guard");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { role: "admin_raiz", whatsapp: null },
    } as any);

    await expect(exigirPortal()).rejects.toThrow("REDIRECT:/painel");
  });

  it("redireciona para /portal/vincular quando o cliente não tem whatsapp", async () => {
    const { auth } = await import("@/auth");
    const { exigirPortal } = await import("@/portal/guard");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { role: "cliente", whatsapp: null },
    } as any);

    await expect(exigirPortal()).rejects.toThrow("REDIRECT:/portal/vincular");
  });

  it("retorna o usuário quando o cliente tem whatsapp vinculado", async () => {
    const { auth } = await import("@/auth");
    const { redirect } = await import("next/navigation");
    const { exigirPortal } = await import("@/portal/guard");

    const user = { role: "cliente", whatsapp: "5511999999999" };
    vi.mocked(auth).mockResolvedValueOnce({ user } as any);

    await expect(exigirPortal()).resolves.toEqual(user);
    expect(redirect).not.toHaveBeenCalled();
  });
});
