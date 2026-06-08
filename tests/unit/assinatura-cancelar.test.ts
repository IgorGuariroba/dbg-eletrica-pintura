import { describe, expect, it } from "vitest";
import type {
  AssinaturaCarregada,
  AssinaturaRepo,
  PatchAssinatura,
} from "@/assinatura/assinatura-repo";
import { cancelarAssinatura } from "@/assinatura/cancelar-assinatura";

/**
 * Fake do repo: serve `carregarPorPreapproval` com uma assinatura ATIVA e
 * registra a pendência de cancelamento marcada + patches de status.
 */
function fakeRepo(over: Partial<AssinaturaCarregada> = {}) {
  const carregada: AssinaturaCarregada = {
    id: "ass-1",
    clienteId: "cli-1",
    planoId: "pln-1",
    status: "ATIVA",
    fimCicloAtual: new Date("2026-06-28T00:00:00Z"),
    planoPendenteId: null,
    cancelamentoPendente: false,
    dataEfetivacao: null,
    ...over,
  };
  const cancelamentos: { id: string; motivo: string; dataEfetivacao: Date }[] =
    [];
  const patches: { id: string; patch: PatchAssinatura }[] = [];
  const repo: AssinaturaRepo = {
    async criar() {
      return { id: "ass-1" };
    },
    async registrarEvento() {
      return true;
    },
    async atualizarStatus(id, patch) {
      patches.push({ id, patch });
    },
    async carregarPorPreapproval() {
      return carregada;
    },
    async marcarCancelamentoPendente(id, dados) {
      cancelamentos.push({ id, ...dados });
    },
  };
  return { repo, cancelamentos, patches };
}

const gatewaySpy = () => {
  const calls: { id: string; motivo: string }[] = [];
  return {
    calls,
    gateway: {
      async cancelarAssinatura(id: string, motivo: string) {
        calls.push({ id, motivo });
      },
    },
  };
};

describe("cancelarAssinatura", () => {
  it("exige motivo não-vazio e não toca no MP", async () => {
    const { repo } = fakeRepo();
    const { gateway, calls } = gatewaySpy();

    await expect(
      cancelarAssinatura({ preapprovalIdMp: "pre-1", motivo: "  " }, {
        gateway,
        repo,
      }),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it("encerra cobrança no MP, agenda efetivação no fim do ciclo e cancela preventivas futuras — sem mudar o status", async () => {
    const { repo, cancelamentos, patches } = fakeRepo();
    const { gateway, calls } = gatewaySpy();
    const preventivas: { assinaturaId: string; fimCiclo: Date }[] = [];

    await cancelarAssinatura(
      { preapprovalIdMp: "pre-1", motivo: "cliente desistiu" },
      {
        gateway,
        repo,
        cancelarPreventivas: async (assinaturaId, fimCiclo) => {
          preventivas.push({ assinaturaId, fimCiclo });
        },
      },
    );

    expect(calls).toEqual([{ id: "pre-1", motivo: "cliente desistiu" }]);
    expect(cancelamentos).toEqual([
      {
        id: "pre-1",
        motivo: "cliente desistiu",
        dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
      },
    ]);
    expect(preventivas).toEqual([
      { assinaturaId: "ass-1", fimCiclo: new Date("2026-06-28T00:00:00Z") },
    ]);
    // Status NÃO muda agora: a troca para CANCELADA é no fim do ciclo.
    expect(patches).toEqual([]);
  });

  it("falha quando a assinatura não existe", async () => {
    const { repo } = fakeRepo();
    repo.carregarPorPreapproval = async () => null;
    const { gateway } = gatewaySpy();

    await expect(
      cancelarAssinatura({ preapprovalIdMp: "sumiu", motivo: "qualquer" }, {
        gateway,
        repo,
      }),
    ).rejects.toThrow();
  });
});
