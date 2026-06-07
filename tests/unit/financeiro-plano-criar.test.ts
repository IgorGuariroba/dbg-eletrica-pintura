import { describe, expect, it } from "vitest";
import { criarPlano } from "@/financeiro/planos/criar-plano";
import type {
  NovoPlano,
  Plano,
  PlanoRepo,
} from "@/financeiro/planos/plano-repo";

function fakeRepo() {
  const inseridos: NovoPlano[] = [];
  const repo: PlanoRepo = {
    async inserir(novo) {
      inseridos.push(novo);
      return {
        id: "pln-1",
        preapprovalPlanIdMp: null,
        criadoEm: new Date("2026-01-01T00:00:00Z"),
        ...novo,
      } satisfies Plano;
    },
    async atualizar() {
      return null;
    },
    async toggleAtivo() {
      return null;
    },
    async buscarPorId() {
      return null;
    },
    async listarAtivos() {
      return [];
    },
    async listarTodos() {
      return [];
    },
    async definirPreapprovalPlanIdMp() {},
  };
  return { repo, inseridos };
}

describe("criarPlano", () => {
  it("persiste o plano com os campos normalizados", async () => {
    const { repo, inseridos } = fakeRepo();

    const plano = await criarPlano(
      {
        nome: "  Conforto  ",
        preco: "149.90",
        beneficios: "4 preventivas\n10% de desconto",
        percentualDesconto: "10",
        preventivasPorAno: 4,
        prioridadeAgendamento: true,
      },
      repo,
    );

    expect(plano.id).toBe("pln-1");
    expect(inseridos).toHaveLength(1);
    expect(inseridos[0]).toMatchObject({
      nome: "Conforto",
      preco: "149.90",
      percentualDesconto: "10",
      preventivasPorAno: 4,
      prioridadeAgendamento: true,
      ativo: true,
    });
  });

  it("aplica defaults: prioridade=false e ativo=true", async () => {
    const { repo, inseridos } = fakeRepo();

    await criarPlano(
      {
        nome: "Básico",
        preco: "79.90",
        beneficios: null,
        percentualDesconto: "5",
        preventivasPorAno: 2,
      },
      repo,
    );

    expect(inseridos[0]).toMatchObject({
      prioridadeAgendamento: false,
      ativo: true,
      beneficios: null,
    });
  });

  const base = {
    nome: "X",
    preco: "100.00",
    beneficios: null,
    percentualDesconto: "10",
    preventivasPorAno: 2,
  };

  it("rejeita percentual de desconto acima de 100", async () => {
    const { repo } = fakeRepo();
    await expect(
      criarPlano({ ...base, percentualDesconto: "120" }, repo),
    ).rejects.toThrow();
  });

  it("rejeita preço negativo", async () => {
    const { repo } = fakeRepo();
    await expect(
      criarPlano({ ...base, preco: "-10.00" }, repo),
    ).rejects.toThrow();
  });

  it("rejeita número de preventivas negativo", async () => {
    const { repo } = fakeRepo();
    await expect(
      criarPlano({ ...base, preventivasPorAno: -1 }, repo),
    ).rejects.toThrow();
  });

  it("rejeita nome vazio", async () => {
    const { repo } = fakeRepo();
    await expect(criarPlano({ ...base, nome: "   " }, repo)).rejects.toThrow();
  });
});
