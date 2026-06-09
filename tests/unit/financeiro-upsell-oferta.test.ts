import { describe, expect, it } from "vitest";
import { montarOfertaUpsell } from "@/financeiro/upsell/montar-upsell";
import { carregarUpsellCheckout } from "@/financeiro/upsell/carregar-upsell-checkout";
import type { PlanoUpsell, UpsellRepo } from "@/financeiro/upsell/upsell-repo";

describe("montarOfertaUpsell", () => {
  it("calcula economia visível sobre a soma pagável", () => {
    const oferta = montarOfertaUpsell({
      somaPagavel: "200.00",
      plano: {
        id: "p1",
        nome: "Conforto",
        slug: "conforto",
        preco: "179.00",
        percentualDesconto: "10",
      },
      totalAssinantes: 12,
    });

    expect(oferta).toEqual({
      planoNome: "Conforto",
      planoSlug: "conforto",
      precoMensal: "179.00",
      percentualDesconto: 10,
      valorComDesconto: "180.00",
      economia: "20.00",
      totalAssinantes: 12,
    });
  });
});

const planoConforto: PlanoUpsell = {
  id: "p1",
  nome: "Conforto",
  slug: "conforto",
  preco: "179.00",
  percentualDesconto: "10",
};

function fakeRepo(over: {
  assinante?: boolean;
  vistoEm?: Date | null;
  plano?: PlanoUpsell | null;
}): { repo: UpsellRepo; marcados: { clienteId: string; quando: Date }[] } {
  const marcados: { clienteId: string; quando: Date }[] = [];
  const repo: UpsellRepo = {
    temAssinaturaAtiva: async () => over.assinante ?? false,
    upsellVistoEm: async () => over.vistoEm ?? null,
    marcarUpsellVisto: async (clienteId, quando) => {
      marcados.push({ clienteId, quando });
    },
    planoDestaque: async () =>
      over.plano === undefined ? planoConforto : over.plano,
    contarAssinaturasAtivas: async () => 12,
  };
  return { repo, marcados };
}

describe("carregarUpsellCheckout", () => {
  const agora = new Date("2026-06-09T12:00:00Z");

  it("não-assinante na 1ª vez recebe oferta e fica marcado como visto", async () => {
    const { repo, marcados } = fakeRepo({});

    const oferta = await carregarUpsellCheckout(
      { clienteId: "c1", somaPagavel: "200.00", agora },
      { repo },
    );

    expect(oferta?.planoNome).toBe("Conforto");
    expect(oferta?.economia).toBe("20.00");
    expect(oferta?.totalAssinantes).toBe(12);
    expect(marcados).toEqual([{ clienteId: "c1", quando: agora }]);
  });

  it("não exibe de novo dentro do prazo e não remarca", async () => {
    const { repo, marcados } = fakeRepo({
      vistoEm: new Date("2026-06-01T12:00:00Z"),
    });

    const oferta = await carregarUpsellCheckout(
      { clienteId: "c1", somaPagavel: "200.00", agora },
      { repo },
    );

    expect(oferta).toBeNull();
    expect(marcados).toEqual([]);
  });

  it("assinante ativo nunca recebe oferta nem é marcado", async () => {
    const { repo, marcados } = fakeRepo({ assinante: true });

    const oferta = await carregarUpsellCheckout(
      { clienteId: "c1", somaPagavel: "200.00", agora },
      { repo },
    );

    expect(oferta).toBeNull();
    expect(marcados).toEqual([]);
  });

  it("sem plano destaque não há oferta nem marcação", async () => {
    const { repo, marcados } = fakeRepo({ plano: null });

    const oferta = await carregarUpsellCheckout(
      { clienteId: "c1", somaPagavel: "200.00", agora },
      { repo },
    );

    expect(oferta).toBeNull();
    expect(marcados).toEqual([]);
  });
});
