import { describe, expect, it } from "vitest";
import type {
  AssinaturaCarregada,
  AssinaturaRepo,
  PatchAssinatura,
} from "@/assinatura/assinatura-repo";
import { agendarDowngrade } from "@/assinatura/agendar-downgrade";

function fakeRepo(over: Partial<AssinaturaCarregada> = {}) {
  const carregada: AssinaturaCarregada = {
    id: "ass-1",
    clienteId: "cli-1",
    planoId: "pln-premium",
    status: "ATIVA",
    fimCicloAtual: new Date("2026-06-28T00:00:00Z"),
    planoPendenteId: null,
    cancelamentoPendente: false,
    dataEfetivacao: null,
    ...over,
  };
  const downgrades: { id: string; planoPendenteId: string; dataEfetivacao: Date }[] =
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
    async marcarDowngradePendente(id, dados) {
      downgrades.push({ id, ...dados });
    },
  };
  return { repo, downgrades, patches };
}

describe("agendarDowngrade", () => {
  it("recusa quando o plano destino não é mais barato que o atual", async () => {
    const { repo, downgrades } = fakeRepo();

    await expect(
      agendarDowngrade(
        {
          preapprovalIdMp: "pre-1",
          planoAtualPreco: 99.9,
          planoDestino: { id: "pln-basico", preco: 99.9 },
        },
        { repo },
      ),
    ).rejects.toThrow();
    expect(downgrades).toEqual([]);
  });

  it("agenda o downgrade para o fim do ciclo sem mexer no status nem no MP", async () => {
    const { repo, downgrades, patches } = fakeRepo();

    await agendarDowngrade(
      {
        preapprovalIdMp: "pre-1",
        planoAtualPreco: 99.9,
        planoDestino: { id: "pln-basico", preco: 49.9 },
      },
      { repo },
    );

    expect(downgrades).toEqual([
      {
        id: "pre-1",
        planoPendenteId: "pln-basico",
        dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
      },
    ]);
    expect(patches).toEqual([]);
  });
});
