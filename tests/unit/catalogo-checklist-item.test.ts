import { describe, expect, it, vi } from "vitest";
import {
  atualizarChecklistItem,
  criarChecklistItem,
  removerChecklistItem,
} from "@/catalogo/checklist-item";
import type {
  ChecklistItemRepo,
  NovoChecklistItem,
} from "@/catalogo/checklist-repo";

const inputValido = {
  categoria: "ELETRICA",
  ordem: 0,
  descricao: "Verificar disjuntores",
  exigeFoto: true,
} as const;

function repoFake(): ChecklistItemRepo {
  return {
    inserir: vi.fn(async (n: NovoChecklistItem) => ({
      id: "uuid-fake",
      ...n,
      ativo: true,
      criadoEm: new Date(),
    })),
    atualizar: vi.fn(),
    remover: vi.fn(),
    buscarPorId: vi.fn(),
    listarPorCategoria: vi.fn(),
  };
}

describe("criarChecklistItem", () => {
  it("persiste todos os campos quando input é válido", async () => {
    const repo = repoFake();
    const resultado = await criarChecklistItem(inputValido, repo);

    expect(repo.inserir).toHaveBeenCalledWith({
      categoria: "ELETRICA",
      ordem: 0,
      descricao: "Verificar disjuntores",
      exigeFoto: true,
    });
    expect(resultado.id).toBe("uuid-fake");
  });

  it("usa exigeFoto=false como default quando omitido", async () => {
    const repo = repoFake();
    const { exigeFoto: _, ...semFoto } = inputValido;
    await criarChecklistItem(semFoto, repo);
    expect(repo.inserir).toHaveBeenCalledWith(
      expect.objectContaining({ exigeFoto: false }),
    );
  });

  it("rejeita descrição vazia", async () => {
    const repo = repoFake();
    await expect(
      criarChecklistItem({ ...inputValido, descricao: "  " }, repo),
    ).rejects.toThrow(/descrição/i);
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita ordem negativa", async () => {
    const repo = repoFake();
    await expect(
      criarChecklistItem({ ...inputValido, ordem: -1 }, repo),
    ).rejects.toThrow(/ordem/i);
    expect(repo.inserir).not.toHaveBeenCalled();
  });

  it("rejeita categoria fora do enum", async () => {
    const repo = repoFake();
    await expect(
      // @ts-expect-error: testando runtime
      criarChecklistItem({ ...inputValido, categoria: "HIDRAULICA" }, repo),
    ).rejects.toThrow();
  });
});

describe("atualizarChecklistItem", () => {
  it("aplica mudanças parciais válidas", async () => {
    const repo = repoFake();
    await atualizarChecklistItem(
      "id-1",
      { descricao: "Nova descrição", exigeFoto: false, ordem: 2 },
      repo,
    );
    expect(repo.atualizar).toHaveBeenCalledWith("id-1", {
      descricao: "Nova descrição",
      exigeFoto: false,
      ordem: 2,
    });
  });

  it("rejeita descrição vazia na atualização", async () => {
    const repo = repoFake();
    await expect(
      atualizarChecklistItem("id-1", { descricao: "   " }, repo),
    ).rejects.toThrow(/descrição/i);
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("rejeita ordem negativa na atualização", async () => {
    const repo = repoFake();
    await expect(
      atualizarChecklistItem("id-1", { ordem: -3 }, repo),
    ).rejects.toThrow(/ordem/i);
    expect(repo.atualizar).not.toHaveBeenCalled();
  });
});

describe("removerChecklistItem", () => {
  it("delega a remoção ao repo", async () => {
    const repo = repoFake();
    (repo.remover as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const ok = await removerChecklistItem("id-1", repo);
    expect(repo.remover).toHaveBeenCalledWith("id-1");
    expect(ok).toBe(true);
  });
});
