import { describe, expect, it, vi } from "vitest";
import { atualizarServico } from "@/catalogo/atualizar-servico";
import type { Servico, ServicoRepo } from "@/catalogo/servico-repo";

const existente: Servico = {
  id: "uuid-1",
  nome: "Antigo",
  slug: "antigo",
  categoria: "ELETRICA",
  precoBase: "100.00",
  unidade: "PONTO",
  prazoGarantiaMeses: 6,
  fotoUrl: null,
  ativo: true,
  criadoEm: new Date(),
};

function repoFake(): ServicoRepo {
  return {
    inserir: vi.fn(),
    atualizar: vi.fn(async (_id, m) => ({ ...existente, ...m })),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(async () => existente),
    buscarPorSlug: vi.fn(),
    listar: vi.fn(),
  };
}

describe("atualizarServico", () => {
  it("aplica mudanças parciais", async () => {
    const repo = repoFake();
    await atualizarServico("uuid-1", { nome: "Novo", precoBase: "250.00" }, repo);
    expect(repo.atualizar).toHaveBeenCalledWith("uuid-1", {
      nome: "Novo",
      precoBase: "250.00",
    });
  });

  it("rejeita precoBase <= 0", async () => {
    const repo = repoFake();
    await expect(
      atualizarServico("uuid-1", { precoBase: "0" }, repo),
    ).rejects.toThrow(/preço/i);
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("rejeita prazoGarantiaMeses negativo", async () => {
    const repo = repoFake();
    await expect(
      atualizarServico("uuid-1", { prazoGarantiaMeses: -2 }, repo),
    ).rejects.toThrow(/prazo/i);
  });

  it("retorna null quando id não existe", async () => {
    const repo: ServicoRepo = {
      inserir: vi.fn(),
      atualizar: vi.fn(async () => null),
      toggleAtivo: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorSlug: vi.fn(),
      listar: vi.fn(),
    };
    const r = await atualizarServico("inex", { nome: "X" }, repo);
    expect(r).toBeNull();
  });

  it("permite limpar fotoUrl com null", async () => {
    const repo = repoFake();
    await atualizarServico("uuid-1", { fotoUrl: null }, repo);
    expect(repo.atualizar).toHaveBeenCalledWith("uuid-1", { fotoUrl: null });
  });
});
