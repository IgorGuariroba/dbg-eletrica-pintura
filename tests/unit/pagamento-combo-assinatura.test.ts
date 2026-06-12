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

function dadosCombo(over: Partial<DadosPagamento> = {}): DadosPagamento {
  return {
    paymentId: "pay-combo-1",
    status: "approved",
    valor: "429.00",
    metodo: "credit_card",
    osIds: ["os-1"],
    metadata: { assinatura_id: "ass-1", cliente_id: "cli-1" },
    ...over,
  };
}

describe("processarPagamento — combo pagar tudo junto + assinar (#65)", () => {
  it("pagamento aprovado ativa a assinatura do combo e transita a OS", async () => {
    const ativarAssinatura = vi.fn(async () => {});
    const { pagamentoRepo, transicaoRepo } = repos();

    const resultado = await processarPagamento(dadosCombo(), {
      pagamentoRepo,
      transicaoRepo,
      transicionar: async () => ({ registro: {} as never, despacho: Promise.resolve({}) }),
      ativarAssinatura,
    });

    expect(resultado.transitadas).toEqual(["os-1"]);
    expect(ativarAssinatura).toHaveBeenCalledExactlyOnceWith("ass-1");
  });

  it("pagamento rejeitado não ativa assinatura nem transita OS", async () => {
    const ativarAssinatura = vi.fn(async () => {});
    const { pagamentoRepo, transicaoRepo } = repos();

    const resultado = await processarPagamento(
      dadosCombo({ status: "rejected" }),
      {
        pagamentoRepo,
        transicaoRepo,
        transicionar: async () => ({ registro: {} as never, despacho: Promise.resolve({}) }),
        ativarAssinatura,
      },
    );

    expect(resultado.transitadas).toEqual([]);
    expect(ativarAssinatura).not.toHaveBeenCalled();
  });

  it("pagamento sem assinatura_id não toca em assinatura", async () => {
    const ativarAssinatura = vi.fn(async () => {});
    const { pagamentoRepo, transicaoRepo } = repos();

    await processarPagamento(
      dadosCombo({ metadata: undefined }),
      {
        pagamentoRepo,
        transicaoRepo,
        transicionar: async () => ({ registro: {} as never, despacho: Promise.resolve({}) }),
        ativarAssinatura,
      },
    );

    expect(ativarAssinatura).not.toHaveBeenCalled();
  });
});
