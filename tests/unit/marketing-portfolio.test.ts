import { describe, expect, it, vi } from "vitest";
import { aprovarFoto, rejeitarFoto } from "@/marketing/portfolio";
import type {
  CopiadorFotoPublica,
  FotoPortfolio,
  PortfolioRepo,
} from "@/marketing/portfolio-repo";
import {
  FotoJaDecididaError,
  FotoNaoEncontradaError,
} from "@/marketing/portfolio-repo";

function fotoFake(over: Partial<FotoPortfolio> = {}): FotoPortfolio {
  return {
    id: "foto-1",
    osId: "os-1",
    tecnicoId: "tec-1",
    categoria: "ELETRICA",
    tipo: "DEPOIS",
    chavePrivada: "os/os-1/depois/abc.jpg",
    chavePublica: null,
    status: "PENDENTE",
    motivoRejeicao: null,
    temDadoSensivel: false,
    criadoEm: new Date("2026-05-30T12:00:00Z"),
    ...over,
  };
}

function repoFake(over: Partial<PortfolioRepo> = {}): PortfolioRepo {
  return {
    marcar: vi.fn(async () => fotoFake()),
    buscar: vi.fn(async () => fotoFake()),
    listarPendentes: vi.fn(async () => []),
    aprovar: vi.fn(async () => true),
    rejeitar: vi.fn(async () => true),
    listarPublicas: vi.fn(async () => []),
    listarPublicasPorTecnico: vi.fn(async () => []),
    ...over,
  };
}

function copiadorFake(
  over: Partial<CopiadorFotoPublica> = {},
): CopiadorFotoPublica {
  return {
    copiar: vi.fn(async () => ({ chavePublica: "portfolio/abc.jpg" })),
    ...over,
  };
}

describe("aprovarFoto", () => {
  it("copia para o público e aprova com a chave pública", async () => {
    const repo = repoFake();
    const copiador = copiadorFake();
    await aprovarFoto(
      "foto-1",
      { decididoPor: "marketing@dbg.com.br", temDadoSensivel: false },
      repo,
      copiador,
    );
    expect(copiador.copiar).toHaveBeenCalledWith("os/os-1/depois/abc.jpg");
    expect(repo.aprovar).toHaveBeenCalledWith("foto-1", {
      chavePublica: "portfolio/abc.jpg",
      decididoPor: "marketing@dbg.com.br",
      temDadoSensivel: false,
    });
  });

  it("erro se a foto não existe", async () => {
    const repo = repoFake({ buscar: vi.fn(async () => null) });
    await expect(
      aprovarFoto("x", { decididoPor: "m@dbg" }, repo, copiadorFake()),
    ).rejects.toBeInstanceOf(FotoNaoEncontradaError);
  });

  it("erro se a foto já foi decidida (não copia nem aprova)", async () => {
    const copiador = copiadorFake();
    const repo = repoFake({
      buscar: vi.fn(async () => fotoFake({ status: "APROVADA" })),
    });
    await expect(
      aprovarFoto("foto-1", { decididoPor: "m@dbg" }, repo, copiador),
    ).rejects.toBeInstanceOf(FotoJaDecididaError);
    expect(copiador.copiar).not.toHaveBeenCalled();
    expect(repo.aprovar).not.toHaveBeenCalled();
  });
});

describe("rejeitarFoto", () => {
  it("rejeita com motivo aparado", async () => {
    const repo = repoFake();
    await rejeitarFoto(
      "foto-1",
      { decididoPor: "m@dbg", motivo: "  desfocada  " },
      repo,
    );
    expect(repo.rejeitar).toHaveBeenCalledWith("foto-1", {
      motivo: "desfocada",
      decididoPor: "m@dbg",
    });
  });

  it("motivo é opcional (vazio vira null)", async () => {
    const repo = repoFake();
    await rejeitarFoto("foto-1", { decididoPor: "m@dbg", motivo: "  " }, repo);
    expect(repo.rejeitar).toHaveBeenCalledWith("foto-1", {
      motivo: null,
      decididoPor: "m@dbg",
    });
  });

  it("erro se a foto já foi decidida", async () => {
    const repo = repoFake({
      buscar: vi.fn(async () => fotoFake({ status: "REJEITADA" })),
    });
    await expect(
      rejeitarFoto("foto-1", { decididoPor: "m@dbg" }, repo),
    ).rejects.toBeInstanceOf(FotoJaDecididaError);
  });
});
