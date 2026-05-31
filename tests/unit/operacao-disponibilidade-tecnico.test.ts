import { describe, expect, it } from "vitest";
import { podeEditarDisponibilidade } from "@/operacao/disponibilidade-tecnico";

describe("podeEditarDisponibilidade", () => {
  it("deixa o próprio técnico editar a sua disponibilidade", () => {
    expect(
      podeEditarDisponibilidade({ id: "t1", podeGerenciarEquipe: false }, "t1"),
    ).toBe(true);
  });

  it("deixa quem gerencia Equipe editar qualquer técnico", () => {
    expect(
      podeEditarDisponibilidade({ id: "admin", podeGerenciarEquipe: true }, "t1"),
    ).toBe(true);
  });

  it("barra um técnico de editar a disponibilidade de outro", () => {
    expect(
      podeEditarDisponibilidade({ id: "t1", podeGerenciarEquipe: false }, "t2"),
    ).toBe(false);
  });
});
