import { describe, expect, it, vi } from "vitest";
import { buscarCep, CepInvalidoError } from "@/operacao/cep";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

describe("buscarCep", () => {
  it("retorna endereço normalizado", async () => {
    const fetcher = fakeFetch({
      cep: "01000-000",
      logradouro: "Praça da Sé",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "SP",
    });
    const r = await buscarCep("01000-000", fetcher);
    expect(r).toMatchObject({
      cep: "01000000",
      logradouro: "Praça da Sé",
      cidade: "São Paulo",
      uf: "SP",
    });
  });

  it("rejeita CEP com menos de 8 dígitos", async () => {
    await expect(buscarCep("123", fakeFetch({}))).rejects.toBeInstanceOf(
      CepInvalidoError,
    );
  });

  it("rejeita resposta com erro=true do ViaCEP", async () => {
    await expect(
      buscarCep("99999999", fakeFetch({ erro: true })),
    ).rejects.toBeInstanceOf(CepInvalidoError);
  });

  it("rejeita resposta não-ok do servidor", async () => {
    await expect(
      buscarCep("01000000", fakeFetch({}, false)),
    ).rejects.toBeInstanceOf(CepInvalidoError);
  });

  it("aceita CEP com qualquer formatação de máscara", async () => {
    const spy = vi.fn(fakeFetch({
      logradouro: "X",
      localidade: "Y",
      uf: "SP",
    }));
    await buscarCep("  01.000-000 ", spy);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/01000000/"));
  });
});
