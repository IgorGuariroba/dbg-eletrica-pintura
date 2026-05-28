import { describe, expect, it, vi } from "vitest";
import { criarMembro } from "@/equipe/criar-membro";
import {
  EmailDuplicadoError,
  type MembroRepo,
} from "@/equipe/membro-repo";

const inputValido = {
  nome: "Bruna",
  email: "bruna@dbg.com.br",
  modulos: ["FINANCEIRO", "MARKETING"] as const,
  isTecnico: false,
  fotoUrl: null,
  bio: null,
  especialidades: [] as const,
  disponibilidade: null,
  ativo: true,
};

function repoFake(over: Partial<MembroRepo> = {}): MembroRepo {
  return {
    inserir: vi.fn(async (n) => ({ id: "uuid-1", ...n, criadoEm: new Date() })),
    atualizar: vi.fn(),
    toggleAtivo: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorEmail: vi.fn(async () => null),
    listar: vi.fn(),
    ...over,
  };
}

describe("criarMembro", () => {
  it("persiste membro válido com módulos", async () => {
    const repo = repoFake();
    const r = await criarMembro(inputValido, repo);
    expect(r.id).toBe("uuid-1");
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Bruna",
        email: "bruna@dbg.com.br",
        modulos: ["FINANCEIRO", "MARKETING"],
        isTecnico: false,
      }),
    );
  });

  it("normaliza email pra lowercase e trim", async () => {
    const repo = repoFake();
    await criarMembro({ ...inputValido, email: "  BRUNA@DBG.COM.BR " }, repo);
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({ email: "bruna@dbg.com.br" }),
    );
  });

  it("aceita só técnico sem módulos", async () => {
    const repo = repoFake();
    await criarMembro(
      {
        ...inputValido,
        modulos: [],
        isTecnico: true,
        especialidades: ["ELETRICA"],
      },
      repo,
    );
    expect(repo.inserir).toHaveBeenCalled();
  });

  it("rejeita quando não tem módulos nem flag técnico", async () => {
    const repo = repoFake();
    await expect(
      criarMembro({ ...inputValido, modulos: [], isTecnico: false }, repo),
    ).rejects.toThrow(/módulo|técnico/i);
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita email duplicado", async () => {
    const existente = {
      id: "outro",
      ...inputValido,
      criadoEm: new Date(),
    };
    const repo = repoFake({ buscarPorEmail: vi.fn(async () => existente) });
    await expect(criarMembro(inputValido, repo)).rejects.toBeInstanceOf(
      EmailDuplicadoError,
    );
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita email inválido", async () => {
    const repo = repoFake();
    await expect(
      criarMembro({ ...inputValido, email: "naoeemail" }, repo),
    ).rejects.toThrow(/e-mail/i);
  });

  it("rejeita disponibilidade com início >= fim", async () => {
    const repo = repoFake();
    await expect(
      criarMembro(
        {
          ...inputValido,
          isTecnico: true,
          modulos: [],
          disponibilidade: { seg: { inicio: "18:00", fim: "08:00" } },
        },
        repo,
      ),
    ).rejects.toThrow();
  });

  it("aceita disponibilidade válida", async () => {
    const repo = repoFake();
    await criarMembro(
      {
        ...inputValido,
        isTecnico: true,
        modulos: [],
        disponibilidade: {
          seg: { inicio: "08:00", fim: "18:00" },
          ter: { inicio: "08:00", fim: "12:00" },
        },
      },
      repo,
    );
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({
        disponibilidade: expect.objectContaining({
          seg: { inicio: "08:00", fim: "18:00" },
        }),
      }),
    );
  });
});
