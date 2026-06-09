import { describe, expect, it, vi } from "vitest";
import { criarServico } from "@/catalogo/criar-servico";
import type { NovoServico, ServicoRepo } from "@/catalogo/servico-repo";

const inputValido = {
  nome: "Instalação de tomada",
  categoria: "ELETRICA",
  precoBase: "120.00",
  unidade: "PONTO",
  prazoGarantiaMeses: 12,
  fotoUrl: "https://r2.dbg.com.br/servicos/tomada.jpg",
  ativo: true,
} as const;

function repoFake(): ServicoRepo {
  return {
    inserir: vi.fn(async (n: NovoServico) => ({
      id: "uuid-fake",
      slug: "uuid-fake-slug",
      ...n,
      criadoEm: new Date(),
    })),
    atualizar: vi.fn(),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorSlug: vi.fn(),
    listar: vi.fn(),
  };
}

describe("criarServico", () => {
  it("persiste todos os campos quando input é válido", async () => {
    const repo = repoFake();
    const resultado = await criarServico(inputValido, repo);

    expect(repo.inserir).toHaveBeenCalledWith({
      nome: "Instalação de tomada",
      categoria: "ELETRICA",
      precoBase: "120.00",
      unidade: "PONTO",
      prazoGarantiaMeses: 12,
      fotoUrl: "https://r2.dbg.com.br/servicos/tomada.jpg",
      ativo: true,
    });
    expect(resultado.id).toBe("uuid-fake");
  });

  it("aceita fotoUrl opcional ausente", async () => {
    const repo = repoFake();
    const { fotoUrl: _, ...semFoto } = inputValido;
    await criarServico(semFoto, repo);
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({ fotoUrl: null }),
    );
  });

  it("usa ativo=true como default quando omitido", async () => {
    const repo = repoFake();
    const { ativo: _, ...semAtivo } = inputValido;
    await criarServico(semAtivo, repo);
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: true }),
    );
  });

  it("rejeita preço <= 0", async () => {
    const repo = repoFake();
    await expect(
      criarServico({ ...inputValido, precoBase: "0" }, repo),
    ).rejects.toThrow(/preço/i);
    await expect(
      criarServico({ ...inputValido, precoBase: "-1.00" }, repo),
    ).rejects.toThrow(/preço/i);
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita prazoGarantiaMeses negativo", async () => {
    const repo = repoFake();
    await expect(
      criarServico({ ...inputValido, prazoGarantiaMeses: -1 }, repo),
    ).rejects.toThrow(/prazo/i);
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita nome vazio", async () => {
    const repo = repoFake();
    await expect(
      criarServico({ ...inputValido, nome: "  " }, repo),
    ).rejects.toThrow(/nome/i);
  });

  it("rejeita categoria fora do enum", async () => {
    const repo = repoFake();
    await expect(
      // @ts-expect-error: testando runtime
      criarServico({ ...inputValido, categoria: "HIDRAULICA" }, repo),
    ).rejects.toThrow();
  });

  it("rejeita unidade fora do enum", async () => {
    const repo = repoFake();
    await expect(
      // @ts-expect-error: testando runtime
      criarServico({ ...inputValido, unidade: "KM" }, repo),
    ).rejects.toThrow();
  });
});
