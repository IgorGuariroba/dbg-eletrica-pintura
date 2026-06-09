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

describe("processarPagamento — emissão de notificação no PAGA", () => {
  it("notifica a transição para cada OS que vira PAGA", async () => {
    const notificarTransicao = vi.fn();
    const { pagamentoRepo, transicaoRepo } = repos();

    await processarPagamento(dados(), {
      pagamentoRepo,
      transicaoRepo,
      notificarTransicao,
    });

    expect(notificarTransicao).toHaveBeenCalledWith("os-1", "PAGA");
  });

  it("não notifica quando o pagamento não é aprovado", async () => {
    const notificarTransicao = vi.fn();
    const { pagamentoRepo, transicaoRepo } = repos();

    await processarPagamento(dados({ status: "rejected" }), {
      pagamentoRepo,
      transicaoRepo,
      notificarTransicao,
    });

    expect(notificarTransicao).not.toHaveBeenCalled();
  });
});
