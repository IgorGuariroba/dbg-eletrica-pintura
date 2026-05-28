import { describe, expect, it, vi } from "vitest";
import { listarServicos } from "@/catalogo/listar-servicos";
import type { ServicoRepo } from "@/catalogo/servico-repo";

function repo(): ServicoRepo {
  return {
    inserir: vi.fn(),
    atualizar: vi.fn(),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(),
    listar: vi.fn(async () => ({ itens: [], total: 0 })),
  };
}

describe("listarServicos", () => {
  it("passa filtros e paginação default (page=1, perPage=20)", async () => {
    const r = repo();
    await listarServicos({}, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("converte page/perPage em limit/offset", async () => {
    const r = repo();
    await listarServicos({ page: 3, perPage: 10 }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 10, offset: 20 });
  });

  it("aplica filtro de categoria", async () => {
    const r = repo();
    await listarServicos({ categoria: "PINTURA" }, r);
    expect(r.listar).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: "PINTURA" }),
    );
  });

  it("aplica filtro de ativo", async () => {
    const r = repo();
    await listarServicos({ ativo: false }, r);
    expect(r.listar).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: false }),
    );
  });

  it("clampa perPage máx 100 e page mín 1", async () => {
    const r = repo();
    await listarServicos({ page: 0, perPage: 500 }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });

  it("ignora categoria inválida", async () => {
    const r = repo();
    // @ts-expect-error runtime
    await listarServicos({ categoria: "XPTO" }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });
});
