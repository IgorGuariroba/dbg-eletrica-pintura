import { describe, expect, it, vi } from "vitest";
import { reativarOs } from "@/operacao/reativacao";
import {
  EstadoInvalidoError,
  OsInexistenteError,
  SemPermissaoError,
} from "@/operacao/reativacao-repo";
import type { ReativacaoRepo } from "@/operacao/reativacao-repo";

const agora = new Date("2026-05-29T12:00:00Z");

function repoFake(over: Partial<ReativacaoRepo> = {}): ReativacaoRepo {
  return {
    buscarOs: vi.fn(async () => ({
      id: "os-123",
      estado: "REJEITADA" as const,
      metadados: {},
    })),
    reativar: vi.fn(async () => true),
    ...over,
  };
}

describe("reativarOs - Unit", () => {
  it("lanca SemPermissaoError se o usuario nao tiver role admin_raiz e nem modulo OPERACAO", async () => {
    const repo = repoFake();
    const usuario = { membroId: "m-1", role: "membro_interno", modulos: ["CATALOGO"] };

    await expect(
      reativarOs("os-123", usuario, "reativar", repo, agora),
    ).rejects.toBeInstanceOf(SemPermissaoError);

    expect(repo.buscarOs).not.toHaveBeenCalled();
    expect(repo.reativar).not.toHaveBeenCalled();
  });

  it("permite reativacao se o usuario tiver modulo OPERACAO", async () => {
    const repo = repoFake();
    const usuario = { membroId: "m-1", role: "membro_interno", modulos: ["OPERACAO"] };

    await reativarOs("os-123", usuario, "reativar", repo, agora);
    expect(repo.buscarOs).toHaveBeenCalledWith("os-123");
    expect(repo.reativar).toHaveBeenCalled();
  });

  it("permite reativacao se o usuario for admin_raiz mesmo sem modulo explicito", async () => {
    const repo = repoFake();
    const usuario = { membroId: "m-1", role: "admin_raiz", modulos: [] };

    await reativarOs("os-123", usuario, "reativar", repo, agora);
    expect(repo.buscarOs).toHaveBeenCalledWith("os-123");
    expect(repo.reativar).toHaveBeenCalled();
  });

  it("lanca OsInexistenteError se a OS nao for encontrada", async () => {
    const repo = repoFake({
      buscarOs: vi.fn(async () => null),
    });
    const usuario = { membroId: "m-1", role: "admin_raiz", modulos: [] };

    await expect(
      reativarOs("os-invalida", usuario, "reativar", repo, agora),
    ).rejects.toBeInstanceOf(OsInexistenteError);

    expect(repo.reativar).not.toHaveBeenCalled();
  });

  it("lanca EstadoInvalidoError se a OS nao estiver nos estados REJEITADA ou EXPIRADA", async () => {
    const repo = repoFake({
      buscarOs: vi.fn(async () => ({
        id: "os-123",
        estado: "NOVA" as const,
        metadados: {},
      })),
    });
    const usuario = { membroId: "m-1", role: "admin_raiz", modulos: [] };

    await expect(
      reativarOs("os-123", usuario, "reativar", repo, agora),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);

    expect(repo.reativar).not.toHaveBeenCalled();
  });

  it("transita OS de REJEITADA para ORCADA com validade + 7 dias", async () => {
    const repo = repoFake({
      buscarOs: vi.fn(async () => ({
        id: "os-123",
        estado: "REJEITADA" as const,
        metadados: { devolucoes: [] },
      })),
    });
    const usuario = { membroId: "m-1", role: "admin_raiz", modulos: [] };

    await reativarOs("os-123", usuario, "reativar", repo, agora);

    const dataEsperadaValidade = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    expect(repo.reativar).toHaveBeenCalledWith(
      "os-123",
      "ORCADA",
      expect.objectContaining({
        devolucoes: [],
        reativacoes: [
          {
            membroId: "m-1",
            motivo: "reativar",
            deEstado: "REJEITADA",
            em: agora.toISOString(),
          },
        ],
      }),
      dataEsperadaValidade,
    );
  });

  it("transita OS de EXPIRADA para ORCADA limpando e registrando motivo", async () => {
    const repo = repoFake({
      buscarOs: vi.fn(async () => ({
        id: "os-123",
        estado: "EXPIRADA" as const,
        metadados: {},
      })),
    });
    const usuario = { membroId: "m-1", role: "admin_raiz", modulos: [] };

    // Motivo com espaços extras e string vazia
    await reativarOs("os-123", usuario, "   ", repo, agora);

    expect(repo.reativar).toHaveBeenCalledWith(
      "os-123",
      "ORCADA",
      expect.objectContaining({
        reativacoes: [
          {
            membroId: "m-1",
            motivo: null,
            deEstado: "EXPIRADA",
            em: agora.toISOString(),
          },
        ],
      }),
      expect.any(Date),
    );
  });
});
