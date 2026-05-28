import { describe, expect, it, vi } from "vitest";
import { atualizarMembro } from "@/equipe/atualizar-membro";
import {
  EmailDuplicadoError,
  type Membro,
  type MembroRepo,
} from "@/equipe/membro-repo";

const existente: Membro = {
  id: "uuid-1",
  nome: "Bruna",
  email: "bruna@dbg.com.br",
  modulos: ["FINANCEIRO"],
  isTecnico: false,
  fotoUrl: null,
  bio: null,
  especialidades: [],
  disponibilidade: null,
  ativo: true,
  criadoEm: new Date(),
};

function repoFake(over: Partial<MembroRepo> = {}): MembroRepo {
  return {
    inserir: vi.fn(),
    atualizar: vi.fn(async (_id, m) => ({ ...existente, ...m })),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(async () => existente),
    buscarPorEmail: vi.fn(async () => null),
    listar: vi.fn(),
    ...over,
  };
}

describe("atualizarMembro", () => {
  it("aplica mudanças parciais", async () => {
    const repo = repoFake();
    await atualizarMembro("uuid-1", { nome: "Bruna Costa" }, repo);
    expect(repo.atualizar).toHaveBeenCalledWith("uuid-1", { nome: "Bruna Costa" });
  });

  it("rejeita quando tira módulos e não é técnico", async () => {
    const repo = repoFake();
    await expect(
      atualizarMembro("uuid-1", { modulos: [] }, repo),
    ).rejects.toThrow(/módulo|técnico/i);
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("permite tirar módulos quando vira técnico", async () => {
    const repo = repoFake();
    await atualizarMembro(
      "uuid-1",
      { modulos: [], isTecnico: true },
      repo,
    );
    expect(repo.atualizar).toHaveBeenCalled();
  });

  it("rejeita email já usado por outro membro", async () => {
    const outroDono = { ...existente, id: "uuid-2", email: "diego@dbg.com.br" };
    const repo = repoFake({
      buscarPorEmail: vi.fn(async () => outroDono),
    });
    await expect(
      atualizarMembro("uuid-1", { email: "diego@dbg.com.br" }, repo),
    ).rejects.toBeInstanceOf(EmailDuplicadoError);
  });

  it("permite o próprio membro manter o e-mail dele", async () => {
    const repo = repoFake({
      buscarPorEmail: vi.fn(async () => existente),
    });
    await atualizarMembro("uuid-1", { email: "bruna@dbg.com.br" }, repo);
    expect(repo.atualizar).toHaveBeenCalled();
  });

  it("retorna null quando id inexistente e mudança requer leitura", async () => {
    const repo = repoFake({ buscarPorId: vi.fn(async () => null) });
    const r = await atualizarMembro("inex", { modulos: [] }, repo);
    expect(r).toBeNull();
  });
});
