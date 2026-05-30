import { describe, expect, it, vi } from "vitest";
import { criarComplementar } from "@/operacao/complementar";
import type { ComplementarRepo } from "@/operacao/complementar";
import {
  NaoTecnicoError,
  EstadoInvalidoError,
  NaoAtribuidoError,
  ItensObrigatorioError,
} from "@/operacao/orcamento-repo";

const config = { precoLitro: "6.00", kmPorLitro: "10" };

function repoFake(over: Partial<ComplementarRepo> = {}): ComplementarRepo {
  return {
    carregarPai: vi.fn(async () => ({
      id: "pai-1",
      estado: "EM_EXECUCAO" as const,
      tecnicoId: "tec-1",
      categoria: "ELETRICA" as const,
      solicitacaoId: "sol-1",
    })),
    buscarPrecosServicos: vi.fn(async () => [
      { id: "s1", categoria: "ELETRICA" as const, precoBase: "100", ativo: true },
    ]),
    criarComplementarComOrcamento: vi.fn(async () => ({
      osId: "comp-1",
      orcamentoId: "orc-1",
    })),
    marcarAguardando: vi.fn(async () => {}),
    listarComplementares: vi.fn(async () => []),
    ...over,
  };
}

const entrada = {
  osPaiId: "pai-1",
  itens: [{ servicoId: "s1", quantidade: "1" }],
  km: 10,
};

describe("criarComplementar", () => {
  it("rejeita quem não é técnico", async () => {
    await expect(
      criarComplementar(
        entrada,
        { membroId: "tec-1", isTecnico: false },
        config,
        repoFake(),
      ),
    ).rejects.toBeInstanceOf(NaoTecnicoError);
  });

  it("rejeita quando a OS pai não está EM_EXECUÇÃO", async () => {
    const repo = repoFake({
      carregarPai: vi.fn(async () => ({
        id: "pai-1",
        estado: "APROVADA" as const,
        tecnicoId: "tec-1",
        categoria: "ELETRICA" as const,
        solicitacaoId: "sol-1",
      })),
    });
    await expect(
      criarComplementar(entrada, { membroId: "tec-1", isTecnico: true }, config, repo),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });

  it("rejeita quando o criador não é o técnico da OS pai", async () => {
    await expect(
      criarComplementar(
        entrada,
        { membroId: "outro-tec", isTecnico: true },
        config,
        repoFake(),
      ),
    ).rejects.toBeInstanceOf(NaoAtribuidoError);
  });

  it("cria a Complementar herdando da pai, em ORÇADA, com orçamento calculado", async () => {
    const repo = repoFake();
    const out = await criarComplementar(
      entrada,
      { membroId: "tec-1", isTecnico: true },
      config,
      repo,
    );

    expect(out).toEqual({ osId: "comp-1", orcamentoId: "orc-1" });
    expect(repo.criarComplementarComOrcamento).toHaveBeenCalledWith(
      expect.objectContaining({
        solicitacaoId: "sol-1",
        osPaiId: "pai-1",
        categoria: "ELETRICA",
        tecnicoId: "tec-1",
        totalMaoDeObra: "100.00",
        // km 10, 6/L, 10 km/L => 1 litro => R$ 6,00
        totalDeslocamento: "6.00",
        total: "106.00",
        itens: [
          expect.objectContaining({
            servicoId: "s1",
            quantidade: "1.00",
            precoUnitario: "100.00",
            subtotal: "100.00",
          }),
        ],
      }),
    );
  });

  it("exige ao menos um item", async () => {
    const repo = repoFake();
    await expect(
      criarComplementar(
        { ...entrada, itens: [] },
        { membroId: "tec-1", isTecnico: true },
        config,
        repo,
      ),
    ).rejects.toBeInstanceOf(ItensObrigatorioError);
    expect(repo.criarComplementarComOrcamento).not.toHaveBeenCalled();
  });
});
