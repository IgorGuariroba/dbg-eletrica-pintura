import { afterEach, describe, expect, it, vi } from "vitest";
import { dadosEmpresa } from "@/documentos/dados-empresa";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dadosEmpresa", () => {
  it("expõe os dados fixos da empresa (razão, CNPJ, endereço, contato)", () => {
    const d = dadosEmpresa();

    expect(d.razaoSocial).toBeTruthy();
    expect(d.cnpj).toBeTruthy();
    expect(d.endereco).toBeTruthy();
    expect(d.contato).toBeTruthy();
  });

  it("permite sobrescrever a razão social via env", () => {
    vi.stubEnv("EMPRESA_RAZAO_SOCIAL", "DBG Serviços LTDA");

    expect(dadosEmpresa().razaoSocial).toBe("DBG Serviços LTDA");
  });

  it("permite sobrescrever o CNPJ via env", () => {
    vi.stubEnv("EMPRESA_CNPJ", "12.345.678/0001-99");

    expect(dadosEmpresa().cnpj).toBe("12.345.678/0001-99");
  });
});
