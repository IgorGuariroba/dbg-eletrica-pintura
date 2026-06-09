import { describe, expect, it } from "vitest";
import { montarLanding } from "@/marketing/landing/montar-landing";
import type { ServicoLanding } from "@/marketing/landing/montar-landing";

const servicoBase: ServicoLanding = {
  slug: "pintura-parede",
  nome: "Pintura de Parede",
  categoria: "PINTURA",
  precoBase: "300.00",
  fotoUrl: "https://r2/base.jpg",
};

describe("montarLanding — preço", () => {
  it("override com preço promocional menor risca o base e exibe o promo", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: { titulo: null, descricao: null, precoPromo: "199.90" },
      fotosExtras: [],
      upsell: null,
      depoimentos: [],
    });
    expect(view.preco).toEqual({
      base: "300.00",
      promo: "199.90",
      riscado: true,
    });
  });

  it("sem override usa só o preço base, sem risco", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: null,
      fotosExtras: [],
      upsell: null,
      depoimentos: [],
    });
    expect(view.preco).toEqual({
      base: "300.00",
      promo: null,
      riscado: false,
    });
  });

  it("promo maior ou igual ao base é ignorada (defensivo)", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: { titulo: null, descricao: null, precoPromo: "400.00" },
      fotosExtras: [],
      upsell: null,
      depoimentos: [],
    });
    expect(view.preco).toEqual({
      base: "300.00",
      promo: null,
      riscado: false,
    });
  });
});

describe("montarLanding — conteúdo", () => {
  it("sem override deriva título do nome e descrição da categoria", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: null,
      fotosExtras: [],
      upsell: null,
      depoimentos: [],
    });
    expect(view.titulo).toBe("Pintura de Parede");
    expect(view.descricao).toContain("Pintura");
  });

  it("override sobrescreve título e descrição", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: {
        titulo: "Pintura Premium 2024",
        descricao: "Tinta importada",
        precoPromo: null,
      },
      fotosExtras: [],
      upsell: null,
      depoimentos: [],
    });
    expect(view.titulo).toBe("Pintura Premium 2024");
    expect(view.descricao).toBe("Tinta importada");
  });

  it("compõe fotos: base primeiro, extras do override depois", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: null,
      fotosExtras: ["https://r2/extra1.jpg", "https://r2/extra2.jpg"],
      upsell: null,
      depoimentos: [],
    });
    expect(view.fotos).toEqual([
      "https://r2/base.jpg",
      "https://r2/extra1.jpg",
      "https://r2/extra2.jpg",
    ]);
  });

  it("serviço sem foto base usa só as extras", () => {
    const view = montarLanding({
      servico: { ...servicoBase, fotoUrl: null },
      override: null,
      fotosExtras: ["https://r2/extra.jpg"],
      upsell: null,
      depoimentos: [],
    });
    expect(view.fotos).toEqual(["https://r2/extra.jpg"]);
  });

  it("repassa upsell e depoimentos", () => {
    const view = montarLanding({
      servico: servicoBase,
      override: null,
      fotosExtras: [],
      upsell: { slug: "drywall-forro", titulo: "Forro de Drywall" },
      depoimentos: [{ nome: "Ana C.", texto: "Ótimo", nota: 5 }],
    });
    expect(view.upsell).toEqual({
      slug: "drywall-forro",
      titulo: "Forro de Drywall",
    });
    expect(view.depoimentos).toHaveLength(1);
    expect(view.depoimentos[0].nome).toBe("Ana C.");
  });
});
