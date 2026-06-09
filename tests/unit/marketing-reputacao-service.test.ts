import { describe, expect, it } from "vitest";
import type { AvaliacaoGoogle, GatewayGBP } from "@/marketing/gbp/gbp-gateway";
import {
  obterReputacao,
  type FonteReputacaoDbg,
} from "@/marketing/gbp/reputacao-service";

function gatewayFake(avaliacoes: AvaliacaoGoogle[]): GatewayGBP {
  return {
    async listarAvaliacoes() {
      return avaliacoes;
    },
    async responderAvaliacao() {},
  };
}

function fonteDbgFake(media: number | null, total: number): FonteReputacaoDbg {
  return {
    async obterNotaMediaGlobal() {
      return { media, total };
    },
  };
}

function avaliacao(nota: number, resposta: string | null): AvaliacaoGoogle {
  return {
    id: `r-${Math.random()}`,
    autor: "Fulano",
    nota,
    comentario: null,
    criadoEm: new Date(),
    resposta,
  };
}

describe("obterReputacao", () => {
  it("calcula média Google, contagem e respondidas vs sem resposta", async () => {
    const gateway = gatewayFake([
      avaliacao(5, "obrigado"),
      avaliacao(4, null),
      avaliacao(3, null),
    ]);
    const { metricas } = await obterReputacao(gateway, fonteDbgFake(4.8, 50));

    expect(metricas.mediaGoogle).toBeCloseTo(4);
    expect(metricas.totalGoogle).toBe(3);
    expect(metricas.respondidas).toBe(1);
    expect(metricas.semResposta).toBe(2);
  });

  it("expõe nota DBG e diferença Google − DBG", async () => {
    const gateway = gatewayFake([avaliacao(4, null), avaliacao(5, null)]);
    const { metricas } = await obterReputacao(gateway, fonteDbgFake(4.0, 30));

    expect(metricas.mediaDbg).toBe(4.0);
    expect(metricas.totalDbg).toBe(30);
    expect(metricas.diferenca).toBeCloseTo(0.5);
  });

  it("diferença é null quando não há avaliação Google", async () => {
    const gateway = gatewayFake([]);
    const { metricas } = await obterReputacao(gateway, fonteDbgFake(4.5, 10));

    expect(metricas.mediaGoogle).toBeNull();
    expect(metricas.totalGoogle).toBe(0);
    expect(metricas.respondidas).toBe(0);
    expect(metricas.semResposta).toBe(0);
    expect(metricas.diferenca).toBeNull();
  });

  it("diferença é null quando DBG não tem avaliações", async () => {
    const gateway = gatewayFake([avaliacao(5, null)]);
    const { metricas } = await obterReputacao(gateway, fonteDbgFake(null, 0));

    expect(metricas.mediaDbg).toBeNull();
    expect(metricas.diferenca).toBeNull();
  });

  it("repassa as avaliações para a view", async () => {
    const lista = [avaliacao(5, null)];
    const { avaliacoes } = await obterReputacao(
      gatewayFake(lista),
      fonteDbgFake(5, 1),
    );
    expect(avaliacoes).toEqual(lista);
  });
});
