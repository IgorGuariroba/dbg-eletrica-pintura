import { vi, describe, it, expect } from "vitest";
import { ForbiddenError } from "@/auth/require-modulo";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("Fatia 11: exigirFinanceiro guard", () => {
  it("deve lancar ForbiddenError se o usuario nao tiver o modulo FINANCEIRO e nao for admin_raiz", async () => {
    const { auth } = await import("@/auth");
    const { exigirFinanceiro } = await import("@/app/admin/financeiro/guard");

    // 1. Usuário sem módulo
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "membro_interno",
        modulos: ["OPERACAO"],
      },
    } as any);

    await expect(exigirFinanceiro()).rejects.toThrow(ForbiddenError);

    // 2. Usuário com módulo FINANCEIRO
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "membro_interno",
        modulos: ["FINANCEIRO"],
      },
    } as any);

    await expect(exigirFinanceiro()).resolves.toBeUndefined();

    // 3. Admin raiz (mesmo sem módulo cadastrado explicitamente)
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        role: "admin_raiz",
        modulos: [],
      },
    } as any);

    await expect(exigirFinanceiro()).resolves.toBeUndefined();

    // 4. Sem sessão
    vi.mocked(auth).mockResolvedValueOnce(null);
    await expect(exigirFinanceiro()).rejects.toThrow(ForbiddenError);
  });
});
