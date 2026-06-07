import { describe, expect, it } from "vitest";
import type {
  AssinaturaRepo,
  NovaAssinatura,
} from "@/assinatura/assinatura-repo";
import { cancelarAssinatura } from "@/assinatura/cancelar-assinatura";
import { criarAssinatura } from "@/assinatura/criar-assinatura";
import type { GatewayAssinatura } from "@/assinatura/gateway";

function fakeGateway(over: Partial<GatewayAssinatura> = {}): GatewayAssinatura {
  return {
    async criarAssinatura(req) {
      return {
        preapprovalIdMp: "pre-mp-1",
        initPoint: `https://mp/checkout?ref=${req.externalReference}`,
        status: "pending",
      };
    },
    async pausarAssinatura() {},
    async cancelarAssinatura() {},
    async atualizarAssinatura() {},
    async buscarAssinatura(id) {
      return { id, status: "authorized" };
    },
    ...over,
  };
}

function fakeRepo() {
  const criadas: NovaAssinatura[] = [];
  const patches: { id: string; status: string }[] = [];
  const repo: AssinaturaRepo = {
    async criar(a) {
      criadas.push(a);
      return { id: "ass-1" };
    },
    async registrarEvento() {
      return true;
    },
    async atualizarStatus(preapprovalId, patch) {
      patches.push({ id: preapprovalId, status: patch.status });
    },
  };
  return { repo, criadas, patches };
}

describe("criarAssinatura", () => {
  it("cria pre-approval no MP e persiste a assinatura", async () => {
    const { repo, criadas } = fakeRepo();

    const out = await criarAssinatura(
      {
        clienteId: "cli-1",
        planoId: "pln-1",
        preapprovalPlanIdMp: "plan-mp-1",
        payerEmail: "cliente@x.com",
        backUrl: "https://dbg/retorno",
      },
      { gateway: fakeGateway(), repo },
    );

    expect(out.initPoint).toContain("https://mp/checkout");
    expect(out.preapprovalIdMp).toBe("pre-mp-1");
    expect(criadas).toHaveLength(1);
    expect(criadas[0]).toMatchObject({
      clienteId: "cli-1",
      planoId: "pln-1",
      preapprovalIdMp: "pre-mp-1",
    });
  });
});

describe("cancelarAssinatura", () => {
  it("exige motivo não-vazio", async () => {
    const { repo } = fakeRepo();

    await expect(
      cancelarAssinatura("pre-mp-1", "  ", { gateway: fakeGateway(), repo }),
    ).rejects.toThrow();
  });

  it("cancela no MP e marca CANCELADA com motivo", async () => {
    const { repo, patches } = fakeRepo();
    const cancelados: { id: string; motivo: string }[] = [];
    const gateway = fakeGateway({
      async cancelarAssinatura(id, motivo) {
        cancelados.push({ id, motivo });
      },
    });

    await cancelarAssinatura("pre-mp-1", "cliente desistiu", { gateway, repo });

    expect(cancelados).toEqual([{ id: "pre-mp-1", motivo: "cliente desistiu" }]);
    expect(patches).toEqual([{ id: "pre-mp-1", status: "CANCELADA" }]);
  });
});
