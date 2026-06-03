import { describe, expect, it } from "vitest";
import { montarDadosFatura, type FaturaInput } from "@/documentos/dados-fatura";

function input(over: Partial<FaturaInput> = {}): FaturaInput {
  return {
    osId: "a1b2c3d4-0000-0000-0000-000000000000",
    clienteNome: "Maria Silva",
    endereco: {
      logradouro: "Rua Teste",
      numero: "100",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
    },
    tecnicoNome: "João Técnico",
    itens: [
      { descricao: "Tomada", quantidade: "2", precoUnitario: "50.00", subtotal: "100.00" },
      { descricao: "Disjuntor", quantidade: "1", precoUnitario: "80.00", subtotal: "80.00" },
      { descricao: "Fiação", quantidade: "3", precoUnitario: "30.00", subtotal: "90.00" },
    ],
    totalDeslocamento: "20.00",
    total: "290.00",
    pagamento: {
      criadoEm: new Date("2026-06-03T14:30:00Z"),
      metodo: "PIX_DIRETO",
      paymentId: "manual-abc",
    },
    ...over,
  };
}

describe("montarDadosFatura", () => {
  it("mapeia 3 itens preservando o breakdown e os totais", () => {
    const view = montarDadosFatura(input());

    expect(view.itens).toHaveLength(3);
    expect(view.itens[0]).toEqual({
      descricao: "Tomada",
      quantidade: "2",
      precoUnitario: "50.00",
      subtotal: "100.00",
    });
    expect(view.itens[2].descricao).toBe("Fiação");
    expect(view.totalDeslocamento).toBe("20.00");
    expect(view.total).toBe("290.00");
  });

  it("deriva o número da OS dos 8 primeiros caracteres em maiúsculas", () => {
    const view = montarDadosFatura(input());
    expect(view.numeroOS).toBe("A1B2C3D4");
  });

  it("formata o endereço em linha única", () => {
    const view = montarDadosFatura(input());
    expect(view.endereco).toBe("Rua Teste, 100 - Centro, São Paulo - SP");
  });

  it("usa 'manual' como identificador quando o payment_id é sintético", () => {
    const view = montarDadosFatura(input());
    expect(view.identificador).toBe("manual");
    expect(view.formaPagamento).toBe("Pix");
  });

  it("usa o payment_id real do Mercado Pago como identificador", () => {
    const view = montarDadosFatura(
      input({ pagamento: { criadoEm: new Date(), metodo: "credit_card", paymentId: "123456789" } }),
    );
    expect(view.identificador).toBe("123456789");
    expect(view.formaPagamento).toBe("Cartão de crédito");
  });
});
