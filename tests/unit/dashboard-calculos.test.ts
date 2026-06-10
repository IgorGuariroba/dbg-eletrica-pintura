import { describe, expect, it } from "vitest";
import {
  calcularPct,
  calcularMrr,
  montarFunil,
  tecnicosOciosos,
} from "@/features/dashboard/calculos";

describe("calcularPct", () => {
  it("retorna a fração numerador/denominador", () => {
    expect(calcularPct(3, 4)).toBe(0.75);
  });

  it("retorna null quando o denominador é zero (sem base de cálculo)", () => {
    expect(calcularPct(0, 0)).toBeNull();
    expect(calcularPct(5, 0)).toBeNull();
  });
});

describe("calcularMrr", () => {
  it("soma os preços das assinaturas ativas (precisão em centavos)", () => {
    expect(calcularMrr([{ preco: "99.90" }, { preco: "149.90" }])).toBe("249.80");
  });

  it("retorna 0,00 quando não há assinaturas ativas", () => {
    expect(calcularMrr([])).toBe("0.00");
  });

  it("uma assinatura a menos reduz o MRR pelo preço dela", () => {
    const todas = [{ preco: "99.90" }, { preco: "149.90" }];
    const semUma = [{ preco: "99.90" }];
    expect(calcularMrr(todas)).toBe("249.80");
    expect(calcularMrr(semUma)).toBe("99.90");
  });
});

describe("montarFunil", () => {
  it("monta 4 estágios com a conversão de cada etapa relativa à anterior", () => {
    const funil = montarFunil({
      submissoes: 100,
      orcados: 60,
      aprovados: 30,
      concluidos: 24,
    });

    expect(funil).toEqual([
      { nome: "submissoes", total: 100, conversao: null },
      { nome: "orcados", total: 60, conversao: 0.6 },
      { nome: "aprovados", total: 30, conversao: 0.5 },
      { nome: "concluidos", total: 24, conversao: 0.8 },
    ]);
  });

  it("conversão é null quando a etapa anterior é zero (sem base)", () => {
    const funil = montarFunil({ submissoes: 0, orcados: 0, aprovados: 0, concluidos: 0 });
    expect(funil.map((e) => e.conversao)).toEqual([null, null, null, null]);
  });
});

describe("tecnicosOciosos", () => {
  const agora = new Date("2026-06-09T12:00:00Z");

  it("inclui técnico sem nenhuma atribuição (ultimaAtribuicao null)", () => {
    const ociosos = tecnicosOciosos(
      [{ tecnicoId: "t1", nome: "Ana", ultimaAtribuicao: null }],
      7,
      agora,
    );
    expect(ociosos.map((t) => t.tecnicoId)).toEqual(["t1"]);
  });

  it("inclui quem não recebe OS há pelo menos N dias e exclui quem recebeu há menos", () => {
    const ha10dias = new Date("2026-05-30T12:00:00Z");
    const ha2dias = new Date("2026-06-07T12:00:00Z");
    const ociosos = tecnicosOciosos(
      [
        { tecnicoId: "t1", nome: "Ana", ultimaAtribuicao: ha10dias },
        { tecnicoId: "t2", nome: "Bia", ultimaAtribuicao: ha2dias },
      ],
      7,
      agora,
    );
    expect(ociosos.map((t) => t.tecnicoId)).toEqual(["t1"]);
  });
});
