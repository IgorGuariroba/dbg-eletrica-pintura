import { describe, expect, it } from "vitest";
import { montarChaveFotoOs } from "@/operacao/r2-privado";

describe("montarChaveFotoOs", () => {
  it("monta a chave no formato os/{id}/{antes|depois}/{uuid}.jpg", () => {
    const chave = montarChaveFotoOs("abc-123", "ANTES");
    expect(chave).toMatch(
      /^os\/abc-123\/antes\/[0-9a-f-]{36}\.jpg$/,
    );
  });

  it("usa o segmento 'depois' para fotos do tipo DEPOIS", () => {
    const chave = montarChaveFotoOs("os-9", "DEPOIS");
    expect(chave).toMatch(/^os\/os-9\/depois\/[0-9a-f-]{36}\.jpg$/);
  });

  it("gera chaves únicas a cada chamada", () => {
    expect(montarChaveFotoOs("x", "ANTES")).not.toBe(
      montarChaveFotoOs("x", "ANTES"),
    );
  });
});
