import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarGatewayGBP, gbpConfigurado } from "@/marketing/gbp/gbp-gateway";
import { AVALIACOES_GOOGLE_MOCK } from "@/marketing/gbp/gbp-gateway-mock";

const ENV_GBP = [
  "GBP_CLIENT_ID",
  "GBP_CLIENT_SECRET",
  "GBP_REFRESH_TOKEN",
  "GBP_ACCOUNT_ID",
  "GBP_LOCATION_ID",
] as const;

describe("gbpConfigurado", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_GBP) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_GBP) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("é false sem credenciais", () => {
    expect(gbpConfigurado()).toBe(false);
  });

  it("é true só com todas as credenciais presentes", () => {
    for (const k of ENV_GBP) process.env[k] = "x";
    expect(gbpConfigurado()).toBe(true);
  });

  it("é false se faltar qualquer credencial", () => {
    for (const k of ENV_GBP) process.env[k] = "x";
    delete process.env.GBP_REFRESH_TOKEN;
    expect(gbpConfigurado()).toBe(false);
  });
});

describe("criarGatewayGBP (mock)", () => {
  it("sem credenciais devolve mock que serve avaliações falsas", async () => {
    const gateway = criarGatewayGBP({ forceMock: true });
    const avaliacoes = await gateway.listarAvaliacoes();
    expect(avaliacoes).toEqual(AVALIACOES_GOOGLE_MOCK);
    expect(avaliacoes.length).toBeGreaterThan(0);
  });

  it("responderAvaliacao no mock resolve sem erro", async () => {
    const gateway = criarGatewayGBP({ forceMock: true });
    await expect(
      gateway.responderAvaliacao("mock-gbp-2", "Obrigado pelo retorno!"),
    ).resolves.toBeUndefined();
  });
});
