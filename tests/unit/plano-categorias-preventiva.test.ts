import { describe, expect, it, vi } from "vitest";
import { criarPlano } from "@/financeiro/planos/criar-plano";
import type { NovoPlano, Plano, PlanoRepo } from "@/financeiro/planos/plano-repo";

function fakeRepo(): { repo: PlanoRepo; inserir: ReturnType<typeof vi.fn> } {
  const inserir = vi.fn(async (n: NovoPlano): Promise<Plano> => ({
    ...n,
    id: "plano-1",
    slug: "plano-1",
    preapprovalPlanIdMp: null,
    criadoEm: new Date(),
  }));
  const repo = { inserir } as unknown as PlanoRepo;
  return { repo, inserir };
}

const base = {
  nome: "Premium",
  preco: "199.90",
  percentualDesconto: "10",
  preventivasPorAno: 4,
};

describe("criarPlano — categorias da preventiva", () => {
  it("usa [ELETRICA, PINTURA] por padrão quando não informado", async () => {
    const { repo, inserir } = fakeRepo();
    await criarPlano(base, repo);
    expect(inserir.mock.calls[0][0].categoriasPreventiva).toEqual([
      "ELETRICA",
      "PINTURA",
    ]);
  });

  it("respeita as categorias informadas", async () => {
    const { repo, inserir } = fakeRepo();
    await criarPlano({ ...base, categoriasPreventiva: ["ELETRICA"] }, repo);
    expect(inserir.mock.calls[0][0].categoriasPreventiva).toEqual(["ELETRICA"]);
  });
});
