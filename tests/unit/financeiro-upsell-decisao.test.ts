import { afterEach, describe, expect, it } from "vitest";
import {
  decidirExibirUpsell,
  prazoReexibicaoDias,
} from "@/financeiro/upsell/decidir-upsell";

describe("decidirExibirUpsell", () => {
  it("exibe para não-assinante que nunca viu o upsell", () => {
    const exibe = decidirExibirUpsell({
      assinanteAtivo: false,
      upsellVistoEm: null,
      agora: new Date("2026-06-09T12:00:00Z"),
      prazoReexibicaoDias: 90,
    });

    expect(exibe).toBe(true);
  });

  it("nunca exibe para assinante ativo, mesmo que nunca tenha visto", () => {
    const exibe = decidirExibirUpsell({
      assinanteAtivo: true,
      upsellVistoEm: null,
      agora: new Date("2026-06-09T12:00:00Z"),
      prazoReexibicaoDias: 90,
    });

    expect(exibe).toBe(false);
  });

  it("não exibe se viu há menos que o prazo de reexibição", () => {
    const exibe = decidirExibirUpsell({
      assinanteAtivo: false,
      upsellVistoEm: new Date("2026-05-30T12:00:00Z"), // há 10 dias
      agora: new Date("2026-06-09T12:00:00Z"),
      prazoReexibicaoDias: 90,
    });

    expect(exibe).toBe(false);
  });

  it("exibe de novo após o prazo de reexibição", () => {
    const exibe = decidirExibirUpsell({
      assinanteAtivo: false,
      upsellVistoEm: new Date("2026-03-10T12:00:00Z"), // há 91 dias
      agora: new Date("2026-06-09T12:00:00Z"),
      prazoReexibicaoDias: 90,
    });

    expect(exibe).toBe(true);
  });

  it("respeita prazo de reexibição customizado", () => {
    const exibe = decidirExibirUpsell({
      assinanteAtivo: false,
      upsellVistoEm: new Date("2026-05-09T12:00:00Z"), // há 31 dias
      agora: new Date("2026-06-09T12:00:00Z"),
      prazoReexibicaoDias: 30,
    });

    expect(exibe).toBe(true);
  });
});

describe("prazoReexibicaoDias", () => {
  afterEach(() => {
    delete process.env.UPSELL_REEXIBICAO_DIAS;
  });

  it("usa default de 90 dias sem env", () => {
    expect(prazoReexibicaoDias()).toBe(90);
  });

  it("lê UPSELL_REEXIBICAO_DIAS quando definida", () => {
    process.env.UPSELL_REEXIBICAO_DIAS = "30";
    expect(prazoReexibicaoDias()).toBe(30);
  });

  it("ignora valor inválido e cai no default", () => {
    process.env.UPSELL_REEXIBICAO_DIAS = "abc";
    expect(prazoReexibicaoDias()).toBe(90);
  });
});
