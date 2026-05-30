import { describe, expect, it, vi } from "vitest";
import { listarMembros } from "@/equipe/listar-membros";
import { toggleAtivoMembro } from "@/equipe/toggle-ativo-membro";
import type { Membro, MembroRepo } from "@/equipe/membro-repo";

function repo(over: Partial<MembroRepo> = {}): MembroRepo {
  return {
    inserir: vi.fn(),
    atualizar: vi.fn(),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorEmail: vi.fn(),
    buscarPorSlug: vi.fn(),
    listar: vi.fn(async () => ({ itens: [], total: 0 })),
    ...over,
  };
}

describe("listarMembros", () => {
  it("default page/perPage", async () => {
    const r = repo();
    await listarMembros({}, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("converte page/perPage", async () => {
    const r = repo();
    await listarMembros({ page: 2, perPage: 50 }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 50, offset: 50 });
  });

  it("aplica papel", async () => {
    const r = repo();
    await listarMembros({ papel: "tecnico" }, r);
    expect(r.listar).toHaveBeenCalledWith(
      expect.objectContaining({ papel: "tecnico" }),
    );
  });

  it("passa papel=ambos pro repo (filtro de compostos)", async () => {
    const r = repo();
    await listarMembros({ papel: "ambos" }, r);
    expect(r.listar).toHaveBeenCalledWith(
      expect.objectContaining({ papel: "ambos" }),
    );
  });

  it("ignora papel inválido", async () => {
    const r = repo();
    // @ts-expect-error runtime
    await listarMembros({ papel: "outro" }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("clampa perPage máx 100", async () => {
    const r = repo();
    await listarMembros({ perPage: 1000 }, r);
    expect(r.listar).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });
});

const base: Membro = {
  id: "x",
  nome: "X",
  email: "x@y.com",
  modulos: ["FINANCEIRO"],
  isTecnico: false,
  fotoUrl: null,
  bio: null,
  especialidades: [],
  disponibilidade: null,
  ativo: true,
  slug: "x",
  criadoEm: new Date(),
};

describe("toggleAtivoMembro", () => {
  it("delega repo atômico", async () => {
    const r = repo({ toggleAtivo: vi.fn(async () => ({ ...base, ativo: false })) });
    const out = await toggleAtivoMembro("x", r);
    expect(r.toggleAtivo).toHaveBeenCalledWith("x");
    expect(out?.ativo).toBe(false);
  });

  it("retorna null quando id inexistente", async () => {
    const r = repo({ toggleAtivo: vi.fn(async () => null) });
    expect(await toggleAtivoMembro("nope", r)).toBeNull();
  });
});
