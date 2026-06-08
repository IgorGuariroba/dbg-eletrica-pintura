import { describe, expect, it } from "vitest";
import type {
  AssinaturaCarregada,
  AssinaturaRepo,
} from "@/assinatura/assinatura-repo";
import { efetivarPendencias } from "@/assinatura/efetivar-pendencias";

function build(over: Partial<AssinaturaCarregada>) {
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
  const efetivouCancel: string[] = [];
  const efetivouDown: { id: string; novoPlanoId: string }[] = [];
  const recorrencias: { id: string; valor: number }[] = [];
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
    async efetivarCancelamento(id) {
      efetivouCancel.push(id);
    },
    async efetivarDowngrade(id, novoPlanoId) {
      efetivouDown.push({ id, novoPlanoId });
    },
  };
  const deps = {
    repo,
    gatewayAssinatura: {
      async atualizarAssinatura(id: string, valor: number) {
        recorrencias.push({ id, valor });
      },
    },
    obterPrecoPlano: async () => 49.9,
  };
  return { deps, efetivouCancel, efetivouDown, recorrencias };
}

const AGORA = new Date("2026-06-28T01:00:00Z"); // logo após o fim do ciclo

describe("efetivarPendencias", () => {
  it("não faz nada quando não há pendência agendada", async () => {
    const { deps, efetivouCancel, efetivouDown } = build({});

    const out = await efetivarPendencias("pre-1", deps, AGORA);

    expect(out.efetivado).toBe(false);
    expect(efetivouCancel).toEqual([]);
    expect(efetivouDown).toEqual([]);
  });

  it("não efetiva enquanto o ciclo não chegou ao fim", async () => {
    const { deps, efetivouDown } = build({
      planoPendenteId: "pln-basico",
      dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
    });

    const out = await efetivarPendencias(
      "pre-1",
      deps,
      new Date("2026-06-20T00:00:00Z"), // antes do fim do ciclo
    );

    expect(out.efetivado).toBe(false);
    expect(efetivouDown).toEqual([]);
  });

  it("efetiva o cancelamento agendado quando o ciclo termina", async () => {
    const { deps, efetivouCancel } = build({
      cancelamentoPendente: true,
      dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
    });

    const out = await efetivarPendencias("pre-1", deps, AGORA);

    expect(out).toEqual({ efetivado: true, tipo: "cancelamento" });
    expect(efetivouCancel).toEqual(["pre-1"]);
  });

  it("efetiva o downgrade agendado: baixa a recorrência e troca o plano", async () => {
    const { deps, efetivouDown, recorrencias } = build({
      planoPendenteId: "pln-basico",
      dataEfetivacao: new Date("2026-06-28T00:00:00Z"),
    });

    const out = await efetivarPendencias("pre-1", deps, AGORA);

    expect(out).toEqual({ efetivado: true, tipo: "downgrade" });
    expect(recorrencias).toEqual([{ id: "pre-1", valor: 49.9 }]);
    expect(efetivouDown).toEqual([{ id: "pre-1", novoPlanoId: "pln-basico" }]);
  });
});
