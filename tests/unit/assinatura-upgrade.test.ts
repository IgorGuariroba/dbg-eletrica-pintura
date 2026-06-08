import { describe, expect, it } from "vitest";
import type {
  AssinaturaCarregada,
  AssinaturaRepo,
} from "@/assinatura/assinatura-repo";
import { upgradeAssinatura } from "@/assinatura/upgrade-assinatura";

function fakeRepo(over: Partial<AssinaturaCarregada> = {}) {
  const carregada: AssinaturaCarregada = {
    id: "ass-1",
    clienteId: "cli-1",
    planoId: "pln-basico",
    status: "ATIVA",
    fimCicloAtual: new Date("2026-06-28T00:00:00Z"),
    planoPendenteId: null,
    cancelamentoPendente: false,
    dataEfetivacao: null,
    ...over,
  };
  const trocas: { id: string; novoPlanoId: string }[] = [];
  const repo: AssinaturaRepo = {
    async criar() {
      return { id: "ass-1" };
    },
    async registrarEvento() {
      return true;
    },
    async atualizarStatus() {},
    async carregarPorPreapproval() {
      return carregada;
    },
    async trocarPlano(id, novoPlanoId) {
      trocas.push({ id, novoPlanoId });
    },
  };
  return { repo, trocas };
}

function deps(repo: AssinaturaRepo) {
  const cobrancas: { valor: number; clienteId: string }[] = [];
  const recorrencias: { id: string; valor: number }[] = [];
  return {
    cobrancas,
    recorrencias,
    deps: {
      repo,
      gatewayAssinatura: {
        async atualizarAssinatura(id: string, valor: number) {
          recorrencias.push({ id, valor });
        },
      },
      cobrarDiferenca: async (input: {
        valor: number;
        descricao: string;
        clienteId: string;
      }) => {
        cobrancas.push({ valor: input.valor, clienteId: input.clienteId });
        return { pagamentoId: "pay-1", link: "https://mp/pay/1" };
      },
    },
  };
}

describe("upgradeAssinatura", () => {
  it("recusa quando o plano destino não é mais caro que o atual", async () => {
    const { repo, trocas } = fakeRepo();
    const { deps: d, cobrancas } = deps(repo);

    await expect(
      upgradeAssinatura(
        {
          preapprovalIdMp: "pre-1",
          planoAtualPreco: 99.9,
          planoDestino: { id: "pln-premium", preco: 99.9 },
        },
        d,
      ),
    ).rejects.toThrow();
    expect(cobrancas).toEqual([]);
    expect(trocas).toEqual([]);
  });

  it("cobra a diferença proporcional, sobe a recorrência e troca o plano na hora", async () => {
    const { repo, trocas } = fakeRepo();
    const { deps: d, cobrancas, recorrencias } = deps(repo);

    const out = await upgradeAssinatura(
      {
        preapprovalIdMp: "pre-1",
        planoAtualPreco: 49.9,
        planoDestino: { id: "pln-premium", preco: 99.9 },
      },
      d,
      new Date("2026-06-13T00:00:00Z"), // 15 dias restantes → diff 25.00
    );

    expect(cobrancas).toEqual([{ valor: 25, clienteId: "cli-1" }]);
    expect(recorrencias).toEqual([{ id: "pre-1", valor: 99.9 }]);
    expect(trocas).toEqual([{ id: "pre-1", novoPlanoId: "pln-premium" }]);
    expect(out.diferencaCobrada).toBe(25);
    expect(out.pagamento?.link).toBe("https://mp/pay/1");
  });

  it("sem dias restantes não cobra diferença, mas atualiza recorrência e troca o plano", async () => {
    const { repo, trocas } = fakeRepo();
    const { deps: d, cobrancas, recorrencias } = deps(repo);

    const out = await upgradeAssinatura(
      {
        preapprovalIdMp: "pre-1",
        planoAtualPreco: 49.9,
        planoDestino: { id: "pln-premium", preco: 99.9 },
      },
      d,
      new Date("2026-07-10T00:00:00Z"), // ciclo expirado → diff 0
    );

    expect(cobrancas).toEqual([]);
    expect(recorrencias).toEqual([{ id: "pre-1", valor: 99.9 }]);
    expect(trocas).toEqual([{ id: "pre-1", novoPlanoId: "pln-premium" }]);
    expect(out.diferencaCobrada).toBe(0);
    expect(out.pagamento).toBeUndefined();
  });
});
