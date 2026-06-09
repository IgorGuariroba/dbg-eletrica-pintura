import { describe, expect, it, vi } from "vitest";
import {
  ativarAssinaturaCombinada,
  fimDoPrimeiroCiclo,
  type AssinaturaCombinadaRepo,
} from "@/assinatura/assinatura-combinada";

function fakeRepo(
  resultado: "ativada" | "nao_pendente" | "nao_encontrada",
): AssinaturaCombinadaRepo & { ativacoes: unknown[] } {
  const ativacoes: unknown[] = [];
  return {
    ativacoes,
    criarPendente: vi.fn(async () => ({ id: "ass-1" })),
    ativarSePendente: vi.fn(async (id, dados) => {
      ativacoes.push({ id, ...dados });
      return resultado;
    }),
  };
}

describe("ativarAssinaturaCombinada", () => {
  const agora = new Date("2026-06-09T12:00:00Z");

  it("ativa assinatura PENDENTE com ciclo de 1 mês e dispara boas-vindas", async () => {
    const repo = fakeRepo("ativada");
    const enviarBoasVindas = vi.fn(async () => {});

    const res = await ativarAssinaturaCombinada(
      "ass-1",
      { repo, enviarBoasVindas },
      agora,
    );

    expect(res.ativada).toBe(true);
    expect(repo.ativacoes).toEqual([
      {
        id: "ass-1",
        inicio: agora,
        fimCicloAtual: new Date("2026-07-09T12:00:00Z"),
      },
    ]);
    expect(enviarBoasVindas).toHaveBeenCalledExactlyOnceWith("ass-1");
  });

  it("webhook duplicado (já ATIVA) não reativa nem reenvia boas-vindas", async () => {
    const repo = fakeRepo("nao_pendente");
    const enviarBoasVindas = vi.fn(async () => {});

    const res = await ativarAssinaturaCombinada(
      "ass-1",
      { repo, enviarBoasVindas },
      agora,
    );

    expect(res.ativada).toBe(false);
    expect(enviarBoasVindas).not.toHaveBeenCalled();
  });
});

describe("fimDoPrimeiroCiclo", () => {
  it("soma 1 mês preservando o horário", () => {
    expect(fimDoPrimeiroCiclo(new Date("2026-01-31T10:00:00Z")).getTime()).toBe(
      new Date("2026-03-03T10:00:00Z").getTime(),
    );
  });
});
