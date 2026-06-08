import { describe, expect, it } from "vitest";
import { atualizarPlano } from "@/financeiro/planos/atualizar-plano";
import { toggleAtivoPlano } from "@/financeiro/planos/toggle-ativo-plano";
import type {
  AtualizacaoPlano,
  Plano,
  PlanoRepo,
} from "@/financeiro/planos/plano-repo";

function planoFixo(over: Partial<Plano> = {}): Plano {
  return {
    id: "pln-1",
    nome: "Conforto",
    slug: "conforto",
    preco: "149.90",
    beneficios: null,
    percentualDesconto: "10",
    preventivasPorAno: 4,
    prioridadeAgendamento: true,
    ativo: true,
    preapprovalPlanIdMp: null,
    criadoEm: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function fakeRepo() {
  let atual = planoFixo();
  const mudancasRecebidas: AtualizacaoPlano[] = [];
  const repo: PlanoRepo = {
    async inserir() {
      return atual;
    },
    async atualizar(_id, mudancas) {
      mudancasRecebidas.push(mudancas);
      atual = { ...atual, ...mudancas };
      return atual;
    },
    async buscarPorSlug() {
      return atual;
    },
    async toggleAtivo() {
      atual = { ...atual, ativo: !atual.ativo };
      return atual;
    },
    async buscarPorId() {
      return atual;
    },
    async listarAtivos() {
      return [atual];
    },
    async listarTodos() {
      return [atual];
    },
    async definirPreapprovalPlanIdMp() {},
  };
  return { repo, mudancasRecebidas };
}

describe("atualizarPlano", () => {
  it("aplica as mudanças válidas via repo", async () => {
    const { repo, mudancasRecebidas } = fakeRepo();

    const out = await atualizarPlano(
      "pln-1",
      { preco: "199.90", percentualDesconto: "15" },
      repo,
    );

    expect(out?.preco).toBe("199.90");
    expect(mudancasRecebidas[0]).toMatchObject({
      preco: "199.90",
      percentualDesconto: "15",
    });
  });

  it("rejeita percentual de desconto inválido", async () => {
    const { repo } = fakeRepo();
    await expect(
      atualizarPlano("pln-1", { percentualDesconto: "150" }, repo),
    ).rejects.toThrow();
  });
});

describe("toggleAtivoPlano", () => {
  it("inverte o estado ativo do plano", async () => {
    const { repo } = fakeRepo();
    const out = await toggleAtivoPlano("pln-1", repo);
    expect(out?.ativo).toBe(false);
  });
});
