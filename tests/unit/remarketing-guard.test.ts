import { vi, describe, it, expect } from "vitest";
import { ForbiddenError } from "@/auth/require-modulo";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("Remarketing Guard & Action (Slice H)", () => {
  it("deve lancar ForbiddenError se o usuario nao tiver o modulo MARKETING", async () => {
    const { auth } = await import("@/auth");
    const { exigirMarketing } = await import("@/app/admin/marketing/guard");

    // 1. Usuário sem módulo MARKETING
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "membro_interno",
        modulos: ["FINANCEIRO"],
      },
    } as any);

    await expect(exigirMarketing()).rejects.toThrow(ForbiddenError);

    // 2. Usuário com módulo MARKETING
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "membro_interno",
        modulos: ["MARKETING"],
      },
    } as any);

    await expect(exigirMarketing()).resolves.toBeDefined();

    // 3. Admin raiz (bypassa módulos)
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "admin_raiz",
        modulos: [],
      },
    } as any);

    await expect(exigirMarketing()).resolves.toBeDefined();
  });
});
