import { describe, expect, it, vi } from "vitest";
import {
  aprovarOrcamento,
  precisaExpirar,
  rejeitarOrcamento,
} from "@/operacao/aprovacao";
import type { AprovacaoRepo } from "@/operacao/aprovacao-repo";
import { OsNaoOrcadaError } from "@/operacao/aprovacao-repo";

const agora = new Date("2026-05-29T12:00:00Z");

function repoFake(over: Partial<AprovacaoRepo> = {}): AprovacaoRepo {
  return {
    carregarPorToken: vi.fn(async () => null),
    expirarVencidas: vi.fn(async () => {}),
    aprovar: vi.fn(async () => true),
    rejeitar: vi.fn(async () => true),
    ...over,
  };
}

describe("precisaExpirar", () => {
  it("OS ORÇADA com validade vencida precisa expirar", () => {
    expect(
      precisaExpirar("ORCADA", new Date("2026-05-28T12:00:00Z"), agora),
    ).toBe(true);
  });

  it("OS ORÇADA ainda dentro da validade não expira", () => {
    expect(
      precisaExpirar("ORCADA", new Date("2026-05-30T12:00:00Z"), agora),
    ).toBe(false);
  });

  it("OS já APROVADA nunca expira", () => {
    expect(
      precisaExpirar("APROVADA", new Date("2026-05-01T12:00:00Z"), agora),
    ).toBe(false);
  });
});

describe("aprovarOrcamento", () => {
  it("aprova passando token, osId e assinatura ao repo", async () => {
    const repo = repoFake();
    const assinatura = { token: "tok-1", ip: "1.2.3.4" };
    await aprovarOrcamento("tok-1", "os-1", assinatura, repo);
    expect(repo.aprovar).toHaveBeenCalledWith("tok-1", "os-1", assinatura);
  });

  it("erro quando o repo não transita (OS não está ORÇADA ou expirou)", async () => {
    const repo = repoFake({ aprovar: vi.fn(async () => false) });
    await expect(
      aprovarOrcamento("tok-1", "os-1", { token: "tok-1", ip: "1.2.3.4" }, repo),
    ).rejects.toBeInstanceOf(OsNaoOrcadaError);
  });
});

describe("rejeitarOrcamento", () => {
  it("rejeita com motivo aparado", async () => {
    const repo = repoFake();
    await rejeitarOrcamento("tok-1", "os-1", "  caro demais  ", repo);
    expect(repo.rejeitar).toHaveBeenCalledWith("tok-1", "os-1", "caro demais");
  });

  it("motivo é opcional (vazio vira null)", async () => {
    const repo = repoFake();
    await rejeitarOrcamento("tok-1", "os-1", "   ", repo);
    expect(repo.rejeitar).toHaveBeenCalledWith("tok-1", "os-1", null);
  });

  it("erro quando o repo não transita", async () => {
    const repo = repoFake({ rejeitar: vi.fn(async () => false) });
    await expect(
      rejeitarOrcamento("tok-1", "os-1", "motivo", repo),
    ).rejects.toBeInstanceOf(OsNaoOrcadaError);
  });
});
