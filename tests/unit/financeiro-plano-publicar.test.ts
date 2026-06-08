import { describe, expect, it } from "vitest";
import { publicarPlano } from "@/financeiro/planos/publicar-plano";
import type { GatewayPlanoMP } from "@/financeiro/planos/gateway-plano";
import type { Plano, PlanoRepo } from "@/financeiro/planos/plano-repo";

function planoFixo(over: Partial<Plano> = {}): Plano {
  return {
    id: "pln-1",
    nome: "Conforto",
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

function fakeRepo(plano: Plano) {
  const definidos: { id: string; mpId: string }[] = [];
  const repo: PlanoRepo = {
    async inserir() {
      return plano;
    },
    async atualizar() {
      return plano;
    },
    async toggleAtivo() {
      return plano;
    },
    async buscarPorId() {
      return plano;
    },
    async listarAtivos() {
      return [plano];
    },
    async listarTodos() {
      return [plano];
    },
    async definirPreapprovalPlanIdMp(id, mpId) {
      definidos.push({ id, mpId });
    },
  };
  return { repo, definidos };
}

function fakeGateway() {
  const chamadas: string[] = [];
  const gateway: GatewayPlanoMP = {
    async criarPlanoCobranca(req) {
      chamadas.push(req.nome);
      return { preapprovalPlanIdMp: "plan-mp-1" };
    },
  };
  return { gateway, chamadas };
}

describe("publicarPlano", () => {
  it("cria o template de cobrança no MP e grava o preapprovalPlanIdMp", async () => {
    const { repo, definidos } = fakeRepo(planoFixo());
    const { gateway, chamadas } = fakeGateway();

    const out = await publicarPlano("pln-1", { repo, gateway });

    expect(out.preapprovalPlanIdMp).toBe("plan-mp-1");
    expect(chamadas).toEqual(["Conforto"]);
    expect(definidos).toEqual([{ id: "pln-1", mpId: "plan-mp-1" }]);
  });

  it("é idempotente: plano já espelhado não chama o MP de novo", async () => {
    const { repo, definidos } = fakeRepo(
      planoFixo({ preapprovalPlanIdMp: "plan-mp-existente" }),
    );
    const { gateway, chamadas } = fakeGateway();

    const out = await publicarPlano("pln-1", { repo, gateway });

    expect(out.preapprovalPlanIdMp).toBe("plan-mp-existente");
    expect(chamadas).toHaveLength(0);
    expect(definidos).toHaveLength(0);
  });
});
