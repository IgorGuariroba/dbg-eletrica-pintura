import { describe, expect, it, vi } from "vitest";
import {
  calcularDeslocamento,
  montarOrcamento,
  type ConfigDeslocamento,
  type MontarOrcamentoInput,
  type UsuarioOrcamento,
} from "@/operacao/orcamento";
import type {
  OrcamentoRepo,
  OsParaOrcamento,
  ServicoPreco,
} from "@/operacao/orcamento-repo";
import {
  EstadoInvalidoError,
  ItensObrigatorioError,
  NaoAtribuidoError,
  NaoTecnicoError,
  OrcamentoInvalidoError,
  OsIndisponivelError,
  ServicoInvalidoError,
} from "@/operacao/orcamento-repo";

const config: ConfigDeslocamento = { precoLitro: "6", kmPorLitro: "10" };

function os(over: Partial<OsParaOrcamento> = {}): OsParaOrcamento {
  return {
    id: "os-1",
    estado: "NOVA",
    tecnicoId: "tec-1",
    categoria: "ELETRICA",
    ...over,
  };
}

function repoFake(over: Partial<OrcamentoRepo> = {}): OrcamentoRepo {
  return {
    carregarOsParaOrcamento: vi.fn(async () => os()),
    buscarPrecosServicos: vi.fn(
      async (ids: string[]): Promise<ServicoPreco[]> =>
        ids.map((id) => ({
          id,
          categoria: "ELETRICA",
          precoBase: "100",
          ativo: true,
        })),
    ),
    criarParaOs: vi.fn(async () => ({ id: "orc-1" })),
    ...over,
  };
}

const tecnico: UsuarioOrcamento = { membroId: "tec-1", isTecnico: true };

function input(over: Partial<MontarOrcamentoInput> = {}): MontarOrcamentoInput {
  return {
    osId: "os-1",
    itens: [{ servicoId: "srv-1", quantidade: "2" }],
    km: 20,
    ...over,
  };
}

describe("calcularDeslocamento", () => {
  it("20km × R$6/L ÷ 10 km/L = R$12,00", () => {
    expect(calcularDeslocamento(20, "6", "10")).toBe("12.00");
  });

  it("arredonda para 2 casas (1km ÷ 7 km/L × R$6)", () => {
    expect(calcularDeslocamento(1, "6", "7")).toBe("0.86");
  });
});

describe("montarOrcamento", () => {
  it("rejeita técnico que não está atribuído à OS (403)", async () => {
    const repo = repoFake({
      carregarOsParaOrcamento: vi.fn(async () => os({ tecnicoId: "outro" })),
    });
    const outro: UsuarioOrcamento = { membroId: "tec-1", isTecnico: true };
    await expect(
      montarOrcamento(input(), outro, config, repo),
    ).rejects.toBeInstanceOf(NaoAtribuidoError);
    expect(repo.criarParaOs).not.toHaveBeenCalled();
  });

  it("rejeita usuário que não é técnico", async () => {
    const repo = repoFake();
    const naoTec: UsuarioOrcamento = { membroId: "x", isTecnico: false };
    await expect(
      montarOrcamento(input(), naoTec, config, repo),
    ).rejects.toBeInstanceOf(NaoTecnicoError);
  });

  it("rejeita OS inexistente", async () => {
    const repo = repoFake({ carregarOsParaOrcamento: vi.fn(async () => null) });
    await expect(
      montarOrcamento(input(), tecnico, config, repo),
    ).rejects.toBeInstanceOf(OsIndisponivelError);
  });

  it("rejeita OS que não está NOVA", async () => {
    const repo = repoFake({
      carregarOsParaOrcamento: vi.fn(async () => os({ estado: "ORCADA" })),
    });
    await expect(
      montarOrcamento(input(), tecnico, config, repo),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });

  it("rejeita orçamento sem itens", async () => {
    const repo = repoFake();
    await expect(
      montarOrcamento(input({ itens: [] }), tecnico, config, repo),
    ).rejects.toBeInstanceOf(ItensObrigatorioError);
  });

  it("rejeita km negativo", async () => {
    const repo = repoFake();
    await expect(
      montarOrcamento(input({ km: -1 }), tecnico, config, repo),
    ).rejects.toBeInstanceOf(OrcamentoInvalidoError);
  });

  it("rejeita serviço de categoria diferente da OS", async () => {
    const repo = repoFake({
      buscarPrecosServicos: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({
          id,
          categoria: "PINTURA" as const,
          precoBase: "100",
          ativo: true,
        })),
      ),
    });
    await expect(
      montarOrcamento(input(), tecnico, config, repo),
    ).rejects.toBeInstanceOf(ServicoInvalidoError);
  });

  it("calcula subtotais, total e validade de 7 dias", async () => {
    let recebido: import("@/operacao/orcamento-repo").NovoOrcamento | undefined;
    const repo = repoFake({
      criarParaOs: vi.fn(async (d) => {
        recebido = d;
        return { id: "orc-9" };
      }),
    });
    const r = await montarOrcamento(
      input({ itens: [{ servicoId: "srv-1", quantidade: "2" }], km: 20 }),
      tecnico,
      config,
      repo,
    );
    expect(r.id).toBe("orc-9");
    // 2 × R$100 = 200 (itens) + deslocamento 20km×6÷10 = 12 → total 212
    expect(recebido?.totalMaoDeObra).toBe("200.00");
    expect(recebido?.totalDeslocamento).toBe("12.00");
    expect(recebido?.total).toBe("212.00");
    expect(recebido?.itens[0]?.subtotal).toBe("200.00");
    const dias = Math.round(
      (recebido!.validoAte.getTime() - Date.now()) / 86_400_000,
    );
    expect(dias).toBe(7);
  });

  it("override de deslocamento ignora o cálculo automático", async () => {
    let recebido: import("@/operacao/orcamento-repo").NovoOrcamento | undefined;
    const repo = repoFake({
      criarParaOs: vi.fn(async (d) => {
        recebido = d;
        return { id: "orc-1" };
      }),
    });
    await montarOrcamento(
      input({ km: 20, deslocamentoOverride: "50" }),
      tecnico,
      config,
      repo,
    );
    expect(recebido?.totalDeslocamento).toBe("50.00");
    expect(recebido?.total).toBe("250.00");
  });

  it("erro quando a OS some entre carregar e persistir (corrida)", async () => {
    const repo = repoFake({ criarParaOs: vi.fn(async () => null) });
    await expect(
      montarOrcamento(input(), tecnico, config, repo),
    ).rejects.toBeInstanceOf(OsIndisponivelError);
  });

  it("rejeita override de deslocamento não numérico", async () => {
    const repo = repoFake();
    await expect(
      montarOrcamento(
        input({ deslocamentoOverride: "abc" }),
        tecnico,
        config,
        repo,
      ),
    ).rejects.toBeInstanceOf(OrcamentoInvalidoError);
    expect(repo.criarParaOs).not.toHaveBeenCalled();
  });

  it("rejeita override de deslocamento negativo", async () => {
    const repo = repoFake();
    await expect(
      montarOrcamento(
        input({ deslocamentoOverride: "-10" }),
        tecnico,
        config,
        repo,
      ),
    ).rejects.toBeInstanceOf(OrcamentoInvalidoError);
  });

  it("soma quantidades de itens com o mesmo serviço", async () => {
    let recebido: import("@/operacao/orcamento-repo").NovoOrcamento | undefined;
    const repo = repoFake({
      criarParaOs: vi.fn(async (d) => {
        recebido = d;
        return { id: "orc-1" };
      }),
    });
    await montarOrcamento(
      input({
        itens: [
          { servicoId: "srv-1", quantidade: "2" },
          { servicoId: "srv-1", quantidade: "3" },
        ],
        deslocamentoOverride: "0",
      }),
      tecnico,
      config,
      repo,
    );
    // 5 × R$100 = 500 numa única linha, não duas
    expect(recebido?.itens).toHaveLength(1);
    expect(recebido?.itens[0]?.quantidade).toBe("5.00");
    expect(recebido?.itens[0]?.subtotal).toBe("500.00");
  });
});
