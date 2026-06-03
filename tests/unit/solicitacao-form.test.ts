import { describe, it, expect } from "vitest";
import {
  lerEnderecoForm,
  lerCategoriasForm,
  lerFotosKeysForm,
  lerDataDesejadaForm,
} from "@/operacao/solicitacao-form";

function form(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("solicitacao-form parsers", () => {
  describe("lerEnderecoForm", () => {
    it("mapeia campos completos, faz trim, uppercase na uf e converte lat/lng", () => {
      const end = lerEnderecoForm(
        form([
          ["end_logradouro", "  Rua A  "],
          ["end_numero", "100"],
          ["end_complemento", "Apto 2"],
          ["end_bairro", "Centro"],
          ["end_cidade", "São Paulo"],
          ["end_uf", "sp"],
          ["end_cep", "01000-000"],
          ["end_lat", "-23.5"],
          ["end_lng", "-46.6"],
        ]),
      );

      expect(end).toEqual({
        logradouro: "Rua A",
        numero: "100",
        complemento: "Apto 2",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
        cep: "01000-000",
        lat: -23.5,
        lng: -46.6,
      });
    });

    it("vira undefined nos opcionais vazios e nas coordenadas ausentes", () => {
      const end = lerEnderecoForm(
        form([
          ["end_logradouro", "Rua B"],
          ["end_cidade", "Rio"],
          ["end_uf", "rj"],
        ]),
      );

      expect(end).toMatchObject({
        logradouro: "Rua B",
        cidade: "Rio",
        uf: "RJ",
        numero: undefined,
        complemento: undefined,
        bairro: undefined,
        cep: undefined,
        lat: undefined,
        lng: undefined,
      });
    });
  });

  describe("lerCategoriasForm", () => {
    it("mantém só categorias válidas do enum e descarta lixo", () => {
      const cats = lerCategoriasForm(
        form([
          ["categorias", "ELETRICA"],
          ["categorias", "INVALIDA"],
          ["categorias", "PINTURA"],
        ]),
      );

      expect(cats).toEqual(["ELETRICA", "PINTURA"]);
    });

    it("retorna vazio sem categorias", () => {
      expect(lerCategoriasForm(form([]))).toEqual([]);
    });
  });

  describe("lerFotosKeysForm", () => {
    it("faz trim e remove entradas em branco", () => {
      const keys = lerFotosKeysForm(
        form([
          ["fotosKeys", "  a.jpg "],
          ["fotosKeys", "   "],
          ["fotosKeys", "b.jpg"],
        ]),
      );

      expect(keys).toEqual(["a.jpg", "b.jpg"]);
    });
  });

  describe("lerDataDesejadaForm", () => {
    it("converte string ISO em Date", () => {
      const d = lerDataDesejadaForm(form([["dataDesejada", "2026-07-01"]]));
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toContain("2026-07-01");
    });

    it("retorna null quando ausente ou vazio", () => {
      expect(lerDataDesejadaForm(form([]))).toBeNull();
      expect(lerDataDesejadaForm(form([["dataDesejada", "   "]]))).toBeNull();
    });
  });
});
