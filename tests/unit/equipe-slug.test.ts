import { describe, expect, it, vi } from "vitest";
import { gerarSlugUnico } from "@/equipe/slug";

describe("gerarSlugUnico", () => {
  it("converte o nome para kebab-case minúsculo e remove acentos", async () => {
    const existeSlugMock = vi.fn().mockResolvedValue(false);
    
    const slug1 = await gerarSlugUnico("João da Silva", existeSlugMock);
    expect(slug1).toBe("joao-da-silva");

    const slug2 = await gerarSlugUnico("  André @ Mello!!! ", existeSlugMock);
    expect(slug2).toBe("andre-mello");
  });

  it("retorna 'tecnico' se o nome for composto apenas por caracteres especiais", async () => {
    const existeSlugMock = vi.fn().mockResolvedValue(false);
    const slug = await gerarSlugUnico("!!!", existeSlugMock);
    expect(slug).toBe("tecnico");
  });

  it("adiciona sufixo numérico em caso de colisão de slugs", async () => {
    // Simula que "pedro-silva" e "pedro-silva-1" já existem
    const existeSlugMock = vi
      .fn()
      .mockImplementation(async (s: string) => {
        return s === "pedro-silva" || s === "pedro-silva-1";
      });

    const slug = await gerarSlugUnico("Pedro Silva", existeSlugMock);
    expect(slug).toBe("pedro-silva-2");
    expect(existeSlugMock).toHaveBeenCalledWith("pedro-silva");
    expect(existeSlugMock).toHaveBeenCalledWith("pedro-silva-1");
    expect(existeSlugMock).toHaveBeenCalledWith("pedro-silva-2");
  });
});
