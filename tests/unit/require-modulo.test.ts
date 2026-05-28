import { describe, expect, it } from "vitest";
import { ForbiddenError, podeAcessarModulo } from "@/auth/require-modulo";

describe("podeAcessarModulo", () => {
  it("admin_raiz sempre pode", () => {
    expect(
      podeAcessarModulo("CATALOGO", { role: "admin_raiz", modulos: [] }),
    ).toBe(true);
  });

  it("membro com módulo pode", () => {
    expect(
      podeAcessarModulo("CATALOGO", {
        role: "membro_interno",
        modulos: ["CATALOGO", "FINANCEIRO"],
      }),
    ).toBe(true);
  });

  it("membro sem o módulo não pode", () => {
    expect(
      podeAcessarModulo("CATALOGO", {
        role: "membro_interno",
        modulos: ["FINANCEIRO"],
      }),
    ).toBe(false);
  });

  it("cliente nunca pode", () => {
    expect(
      podeAcessarModulo("CATALOGO", { role: "cliente", modulos: ["CATALOGO"] }),
    ).toBe(false);
  });

  it("sessão null não pode", () => {
    expect(podeAcessarModulo("CATALOGO", null)).toBe(false);
  });
});

describe("ForbiddenError", () => {
  it("status 403", () => {
    const e = new ForbiddenError("CATALOGO");
    expect(e.status).toBe(403);
    expect(e.message).toMatch(/CATALOGO/);
  });
});
