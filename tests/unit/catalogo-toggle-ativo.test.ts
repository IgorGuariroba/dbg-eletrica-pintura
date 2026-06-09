import { describe, expect, it, vi } from "vitest";
import { toggleAtivoServico } from "@/catalogo/toggle-ativo-servico";
import type { Servico, ServicoRepo } from "@/catalogo/servico-repo";

const base: Servico = {
  id: "uuid-1",
  nome: "X",
  slug: "x",
  categoria: "ELETRICA",
  precoBase: "100.00",
  unidade: "PONTO",
  prazoGarantiaMeses: 6,
  fotoUrl: null,
  ativo: true,
  criadoEm: new Date(),
};

function repo(resultado: Servico | null): ServicoRepo {
  return {
    inserir: vi.fn(),
    atualizar: vi.fn(),
    toggleAtivo: vi.fn(async () => resultado),
    buscarPorId: vi.fn(),
    buscarPorSlug: vi.fn(),
    listar: vi.fn(),
  };
}

describe("toggleAtivoServico", () => {
  it("delega para repo.toggleAtivo (operação atômica)", async () => {
    const r = repo({ ...base, ativo: false });
    const out = await toggleAtivoServico("uuid-1", r);
    expect(r.toggleAtivo).toHaveBeenCalledWith("uuid-1");
    expect(out?.ativo).toBe(false);
  });

  it("retorna null quando id inexistente", async () => {
    const r = repo(null);
    const out = await toggleAtivoServico("nope", r);
    expect(out).toBeNull();
  });
});
