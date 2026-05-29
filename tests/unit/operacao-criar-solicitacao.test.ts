import { describe, expect, it, vi } from "vitest";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import type {
  Categoria,
  ResultadoCriacao,
  SolicitacaoRepo,
} from "@/operacao/solicitacao-repo";

const enderecoValido = {
  logradouro: "Rua das Flores",
  numero: "100",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01000-000",
};

const baseInput = {
  cliente: {
    nome: "Maria",
    whatsapp: "(11) 91234-5678",
  },
  solicitacao: {
    categorias: ["ELETRICA", "PINTURA", "DRYWALL"] as Categoria[],
    descricao: "Problema na fiação + repintar quarto",
    fotosUrls: [],
    endereco: enderecoValido,
    lgpdAceito: true,
  },
};

function repoFake(): SolicitacaoRepo {
  return {
    criarComOrdens: vi.fn(async ({ cliente, solicitacao }) => {
      const clienteCriado = {
        id: "cli-1",
        ...cliente,
        email: cliente.email ?? null,
        endereco: cliente.endereco ?? null,
        criadoEm: new Date(),
      };
      const solicitacaoCriada = {
        id: "sol-1",
        clienteId: clienteCriado.id,
        ...solicitacao,
        criadoEm: new Date(),
      };
      const ordens = solicitacao.categorias.map((cat: Categoria, i: number) => ({
        id: `os-${i}`,
        solicitacaoId: solicitacaoCriada.id,
        categoria: cat,
        tipo: "NORMAL" as const,
        estado: "NOVA" as const,
        criadoEm: new Date(),
      }));
      const r: ResultadoCriacao = {
        cliente: clienteCriado,
        solicitacao: solicitacaoCriada,
        ordens,
      };
      return r;
    }),
    buscarPorToken: vi.fn(),
  };
}

describe("criarSolicitacao", () => {
  it("cria 1 solicitação + N OS (uma por categoria) estado NOVA tipo NORMAL", async () => {
    const repo = repoFake();
    const r = await criarSolicitacao(baseInput, repo, () => "token-fixo");
    expect(r.ordens).toHaveLength(3);
    expect(r.ordens.every((o) => o.estado === "NOVA")).toBe(true);
    expect(r.ordens.every((o) => o.tipo === "NORMAL")).toBe(true);
    expect(r.ordens.map((o) => o.categoria).sort()).toEqual([
      "DRYWALL",
      "ELETRICA",
      "PINTURA",
    ]);
    expect(r.solicitacao.token).toBe("token-fixo");
  });

  it("normaliza whatsapp removendo caracteres não numéricos", async () => {
    const repo = repoFake();
    const r = await criarSolicitacao(baseInput, repo, () => "t");
    expect(r.cliente.whatsapp).toBe("11912345678");
  });

  it("rejeita lgpd não aceito", async () => {
    const repo = repoFake();
    await expect(
      criarSolicitacao(
        { ...baseInput, solicitacao: { ...baseInput.solicitacao, lgpdAceito: false } },
        repo,
      ),
    ).rejects.toThrow(/LGPD/i);
    expect(repo.criarComOrdens).not.toHaveBeenCalled();
  });

  it("rejeita zero categorias", async () => {
    const repo = repoFake();
    await expect(
      criarSolicitacao(
        {
          ...baseInput,
          solicitacao: {
            ...baseInput.solicitacao,
            categorias: [] as Categoria[],
          },
        },
        repo,
      ),
    ).rejects.toThrow(/categoria/i);
  });

  it("rejeita mais de 5 fotos", async () => {
    const repo = repoFake();
    const fotos = Array.from(
      { length: 6 },
      (_, i) => `https://r2/img-${i}.jpg`,
    );
    await expect(
      criarSolicitacao(
        {
          ...baseInput,
          solicitacao: { ...baseInput.solicitacao, fotosUrls: fotos },
        },
        repo,
      ),
    ).rejects.toThrow(/5 fotos/i);
  });

  it("rejeita whatsapp inválido", async () => {
    const repo = repoFake();
    await expect(
      criarSolicitacao(
        { ...baseInput, cliente: { ...baseInput.cliente, whatsapp: "123" } },
        repo,
      ),
    ).rejects.toThrow(/WhatsApp/i);
  });

  it("gera token único quando não passado", async () => {
    const repo = repoFake();
    const r1 = await criarSolicitacao(baseInput, repo);
    const r2 = await criarSolicitacao(baseInput, repo);
    expect(r1.solicitacao.token).not.toBe(r2.solicitacao.token);
    expect(r1.solicitacao.token.length).toBeGreaterThanOrEqual(20);
  });
});
