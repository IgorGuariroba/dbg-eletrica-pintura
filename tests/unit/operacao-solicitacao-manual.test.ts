import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/auth/require-modulo";
import { criarSolicitacao } from "@/operacao/criar-solicitacao";
import {
  autorizarSolicitacaoManual,
  montarSolicitacaoManual,
} from "@/operacao/solicitacao-manual";
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

const dadosBase = {
  cliente: { nome: "Maria", whatsapp: "(11) 91234-5678" },
  categorias: ["ELETRICA", "PINTURA"] as Categoria[],
  descricao: "Trocar tomada e repintar quarto",
  endereco: enderecoValido,
  consentimentoConfirmado: true,
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

describe("montarSolicitacaoManual", () => {
  it("monta input que cria solicitação com origem MANUAL", async () => {
    const repo = repoFake();
    const input = montarSolicitacaoManual(
      dadosBase,
      "operador@dbg.com",
      new Date("2026-05-29T12:00:00Z"),
    );
    const r = await criarSolicitacao(input, repo, () => "token-fixo");
    expect(r.solicitacao.origem).toBe("MANUAL");
  });

  it("registra consentimento verbal (email + timestamp) na descrição", () => {
    const input = montarSolicitacaoManual(
      dadosBase,
      "operador@dbg.com",
      new Date("2026-05-29T12:00:00Z"),
    );
    expect(input.solicitacao.descricao).toContain("operador@dbg.com");
    expect(input.solicitacao.descricao).toContain("2026-05-29T12:00:00.000Z");
    expect(input.solicitacao.descricao).toMatch(/consentimento/i);
  });

  it("preserva a descrição original do admin junto do registro de consentimento", () => {
    const input = montarSolicitacaoManual(
      dadosBase,
      "operador@dbg.com",
      new Date("2026-05-29T12:00:00Z"),
    );
    expect(input.solicitacao.descricao).toContain(
      "Trocar tomada e repintar quarto",
    );
  });

  it("registra consentimento mesmo quando admin não escreve descrição", () => {
    const input = montarSolicitacaoManual(
      { ...dadosBase, descricao: null },
      "operador@dbg.com",
      new Date("2026-05-29T12:00:00Z"),
    );
    expect(input.solicitacao.descricao).toMatch(/consentimento/i);
    expect(input.solicitacao.descricao).toContain("operador@dbg.com");
  });

  it("é indistinguível do público: mesmas categorias geram mesmas N OS NOVA/NORMAL", async () => {
    const repo = repoFake();
    const input = montarSolicitacaoManual(
      dadosBase,
      "operador@dbg.com",
      new Date("2026-05-29T12:00:00Z"),
    );
    const r = await criarSolicitacao(input, repo, () => "token-fixo");
    expect(r.ordens).toHaveLength(2);
    expect(r.ordens.every((o) => o.estado === "NOVA")).toBe(true);
    expect(r.ordens.every((o) => o.tipo === "NORMAL")).toBe(true);
    expect(r.ordens.map((o) => o.categoria).sort()).toEqual([
      "ELETRICA",
      "PINTURA",
    ]);
  });

  it("rejeita criação quando o consentimento verbal não foi confirmado", async () => {
    const repo = repoFake();
    const input = montarSolicitacaoManual(
      { ...dadosBase, consentimentoConfirmado: false },
      "operador@dbg.com",
    );
    await expect(criarSolicitacao(input, repo)).rejects.toThrow(/LGPD/i);
    expect(repo.criarComOrdens).not.toHaveBeenCalled();
  });
});

describe("autorizarSolicitacaoManual", () => {
  it("retorna o email do operador quando membro tem módulo OPERACAO", () => {
    const email = autorizarSolicitacaoManual({
      role: "membro_interno",
      modulos: ["OPERACAO"],
      email: "operador@dbg.com",
    });
    expect(email).toBe("operador@dbg.com");
  });

  it("lança 403 quando membro não tem módulo OPERACAO", () => {
    expect(() =>
      autorizarSolicitacaoManual({
        role: "membro_interno",
        modulos: ["CATALOGO"],
        email: "outro@dbg.com",
      }),
    ).toThrow(ForbiddenError);
  });

  it("lança 403 quando não há sessão", () => {
    expect(() => autorizarSolicitacaoManual(null)).toThrow(ForbiddenError);
  });
});
