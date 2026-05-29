import { describe, expect, it, vi } from "vitest";
import { reverseGeocode, LocalizacaoIndisponivelError } from "@/operacao/geo";

function fetcherFake(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

const respNominatim = {
  address: {
    road: "Avenida Paulista",
    suburb: "Bela Vista",
    city: "São Paulo",
    state: "São Paulo",
    "ISO3166-2-lvl4": "BR-SP",
    postcode: "01310-100",
  },
};

describe("reverseGeocode", () => {
  it("converte coordenadas em endereço (Nominatim)", async () => {
    const r = await reverseGeocode(-23.561, -46.656, fetcherFake(respNominatim));
    expect(r).toEqual({
      cep: "01310100",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
    });
  });

  it("usa fallbacks de cidade/bairro quando o campo principal falta", async () => {
    const r = await reverseGeocode(
      -22,
      -45,
      fetcherFake({
        address: {
          road: "Rua das Flores",
          neighbourhood: "Centro",
          town: "Cidade Pequena",
          "ISO3166-2-lvl4": "BR-MG",
        },
      }),
    );
    expect(r.bairro).toBe("Centro");
    expect(r.cidade).toBe("Cidade Pequena");
    expect(r.uf).toBe("MG");
    expect(r.cep).toBe("");
  });

  it("erro quando a resposta não tem endereço", async () => {
    await expect(
      reverseGeocode(0, 0, fetcherFake({ error: "Unable to geocode" })),
    ).rejects.toBeInstanceOf(LocalizacaoIndisponivelError);
  });

  it("erro quando a requisição falha", async () => {
    await expect(
      reverseGeocode(0, 0, fetcherFake({}, false)),
    ).rejects.toBeInstanceOf(LocalizacaoIndisponivelError);
  });
});
