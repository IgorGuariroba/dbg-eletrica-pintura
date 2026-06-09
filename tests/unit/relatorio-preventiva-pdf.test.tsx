import { describe, expect, it } from "vitest";
import {
  montarDadosRelatorio,
  type RelatorioInput,
} from "@/documentos/dados-relatorio";
import { gerarRelatorioPreventivaPdf } from "@/documentos/relatorio-preventiva";

const input: RelatorioInput = {
  osId: "11111111-2222-3333-4444-555555555555",
  clienteNome: "Maria Souza",
  categoria: "ELETRICA",
  dataVisita: new Date("2026-06-08T00:00:00Z"),
  itens: [
    {
      descricaoSnapshot: "Quadro de disjuntores",
      status: "OK",
      observacao: null,
      fotoUrl: "https://r2/quadro.jpg",
    },
    {
      descricaoSnapshot: "Tomada da cozinha",
      status: "PROBLEMA",
      observacao: "Sem aterramento",
      fotoUrl: "https://r2/tomada.jpg",
    },
  ],
  observacoesGerais: "Recomendada troca da tomada.",
};

describe("montarDadosRelatorio", () => {
  it("mapeia os itens do checklist para a view do relatório", () => {
    const view = montarDadosRelatorio(input);
    expect(view.clienteNome).toBe("Maria Souza");
    expect(view.itens).toHaveLength(2);
    expect(view.itens[1]).toMatchObject({
      descricao: "Tomada da cozinha",
      status: "PROBLEMA",
      observacao: "Sem aterramento",
      temFoto: true,
    });
    expect(view.observacoesGerais).toBe("Recomendada troca da tomada.");
  });

  it("temFoto é falso quando o item não tem foto", () => {
    const view = montarDadosRelatorio({
      ...input,
      itens: [
        { descricaoSnapshot: "X", status: "NA", observacao: null, fotoUrl: null },
      ],
    });
    expect(view.itens[0].temFoto).toBe(false);
  });
});

describe("gerarRelatorioPreventivaPdf", () => {
  it("gera um PDF válido", async () => {
    const buf = await gerarRelatorioPreventivaPdf(montarDadosRelatorio(input));
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });
});
