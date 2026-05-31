import { describe, expect, it } from "vitest";
import { normalizarBairro } from "@/operacao/cobertura";

describe("normalizarBairro", () => {
  it("apara espaços e normaliza para minúsculas", () => {
    expect(normalizarBairro("  Centro ")).toBe("centro");
  });

  it("rejeita nome vazio (só espaços)", () => {
    expect(() => normalizarBairro("   ")).toThrow();
  });
});
