import { describe, expect, it } from "vitest";
import { estadoOsEnum } from "@/db/schema";
import {
  ESTADOS_ENTREGUES,
  foiEntregue,
  podeCobrar,
} from "@/operacao/estado-predicados";
import type { EstadoOs } from "@/operacao/orcamento-repo";

const TODOS = estadoOsEnum.enumValues as readonly EstadoOs[];

describe("podeCobrar", () => {
  it("é cobrável quando a OS está CONCLUIDA", () => {
    expect(podeCobrar("CONCLUIDA")).toBe(true);
  });

  it("não é cobrável quando já está PAGA", () => {
    expect(podeCobrar("PAGA")).toBe(false);
  });

  it("não é cobrável em nenhum outro estado", () => {
    const cobraveis = TODOS.filter(podeCobrar);
    expect(cobraveis).toEqual(["CONCLUIDA"]);
  });
});

describe("foiEntregue", () => {
  it("considera entregue quando CONCLUIDA", () => {
    expect(foiEntregue("CONCLUIDA")).toBe(true);
  });

  it("considera entregue quando PAGA", () => {
    expect(foiEntregue("PAGA")).toBe(true);
  });

  it("não considera entregue em nenhum outro estado", () => {
    const entregues = TODOS.filter(foiEntregue);
    expect(entregues).toEqual(["CONCLUIDA", "PAGA"]);
  });

  it("deriva da constante ESTADOS_ENTREGUES (fonte única p/ filtro SQL)", () => {
    expect([...ESTADOS_ENTREGUES]).toEqual(["CONCLUIDA", "PAGA"]);
  });
});
