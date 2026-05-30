import { describe, expect, it } from "vitest";
import {
  podeIniciarExecucao,
  podeConcluir,
  validarConclusao,
  FotoObrigatoriaError,
} from "@/features/campo/execucao-regras";

describe("podeIniciarExecucao", () => {
  it("libera quando OS APROVADA tem ≥ 1 foto antes", () => {
    expect(podeIniciarExecucao("APROVADA", 1)).toBe(true);
  });

  it("bloqueia OS APROVADA sem foto antes", () => {
    expect(podeIniciarExecucao("APROVADA", 0)).toBe(false);
  });

  it("bloqueia quando a OS não está APROVADA", () => {
    expect(podeIniciarExecucao("NOVA", 3)).toBe(false);
  });
});

describe("podeConcluir", () => {
  it("libera quando OS EM_EXECUCAO tem ≥ 1 foto depois", () => {
    expect(podeConcluir("EM_EXECUCAO", 1)).toBe(true);
  });

  it("bloqueia OS EM_EXECUCAO sem foto depois", () => {
    expect(podeConcluir("EM_EXECUCAO", 0)).toBe(false);
  });
});

describe("validarConclusao", () => {
  it("lança FotoObrigatoriaError ao concluir sem foto depois", () => {
    expect(() => validarConclusao(0)).toThrow(FotoObrigatoriaError);
  });

  it("não lança com ≥ 1 foto depois", () => {
    expect(() => validarConclusao(1)).not.toThrow();
  });
});
