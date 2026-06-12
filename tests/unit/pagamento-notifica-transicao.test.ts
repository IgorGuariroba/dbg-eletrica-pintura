import { describe, expect, it, vi } from "vitest";
import { processarPagamento } from "@/pagamento/processar-pagamento";
import type { PagamentoRepo } from "@/pagamento/pagamento-repo";
import type { TransicaoRepo } from "@/operacao/transicao-repo";
import type { DadosPagamento } from "@/pagamento/webhook";

function repos(estado = "CONCLUIDA") {
  const pagamentoRepo: PagamentoRepo = {
    registrar: vi.fn(async () => true),
    processarReferralPosPagamento: vi.fn(async () => {}),
    consumirCredito: vi.fn(async () => {}),
  };
  const transicaoRepo: TransicaoRepo = {
    carregarContexto: vi.fn(async () => ({
      tipo: "NORMAL" as const,
      estado: estado as never,
      historico: [estado] as never,
    })),
    persistir: vi.fn(async () => {}),
  };
  return { pagamentoRepo, transicaoRepo };
}

function dados(over: Partial<DadosPagamento> = {}): DadosPagamento {
  return {
    paymentId: "pay-1",
    status: "approved",
    valor: "120.00",
    metodo: "pix",
    osIds: ["os-1"],
    ...over,
  };
}

describe("processarPagamento — transição (com despacho) no PAGA", () => {
  it("transiciona (e portanto despacha) cada OS que vira PAGA", async () => {
    const transicionar = vi.fn(async () => ({
      registro: {} as never,
      despacho: Promise.resolve({}),
    }));
    const { pagamentoRepo, transicaoRepo } = repos();

    await processarPagamento(dados(), {
      pagamentoRepo,
      transicaoRepo,
      transicionar,
    });

    expect(transicionar).toHaveBeenCalledWith(
      "os-1",
      "PAGA",
      "mercadopago:webhook",
      "Pagamento pay-1 (pix)",
      expect.any(Date),
    );
  });

  it("não transiciona quando o pagamento não é aprovado", async () => {
    const transicionar = vi.fn(async () => ({
      registro: {} as never,
      despacho: Promise.resolve({}),
    }));
    const { pagamentoRepo, transicaoRepo } = repos();

    await processarPagamento(dados({ status: "rejected" }), {
      pagamentoRepo,
      transicaoRepo,
      transicionar,
    });

    expect(transicionar).not.toHaveBeenCalled();
  });
});
