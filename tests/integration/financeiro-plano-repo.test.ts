import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Categoria, PlanoRepo } from "@/financeiro/planos/plano-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("criarPlanoRepoDrizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: PlanoRepo;
  let planoIds: string[] = [];

  function nova(over: Partial<Parameters<PlanoRepo["inserir"]>[0]> = {}) {
    return {
      nome: `Plano ${Math.random().toString(36).slice(2, 8)}`,
      preco: "99.90",
      beneficios: null,
      percentualDesconto: "10",
      preventivasPorAno: 2,
      categoriasPreventiva: ["ELETRICA", "PINTURA"] as Categoria[],
      prioridadeAgendamento: false,
      ativo: true,
      ...over,
    };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/financeiro/planos/plano-repo-drizzle")
    ).criarPlanoRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (planoIds.length) {
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
    planoIds = [];
  });

  it("listarAtivos retorna só planos ativos", async () => {
    const ativo = await repo.inserir(nova({ ativo: true, preco: "10.00" }));
    const inativo = await repo.inserir(nova({ ativo: false, preco: "20.00" }));
    planoIds.push(ativo.id, inativo.id);

    const ativos = await repo.listarAtivos();
    const ids = ativos.map((p) => p.id);

    expect(ids).toContain(ativo.id);
    expect(ids).not.toContain(inativo.id);
  });

  it("toggleAtivo inverte e atualizar persiste mudanças", async () => {
    const p = await repo.inserir(nova({ ativo: true }));
    planoIds.push(p.id);

    const desativado = await repo.toggleAtivo(p.id);
    expect(desativado?.ativo).toBe(false);

    const atualizado = await repo.atualizar(p.id, {
      percentualDesconto: "25",
    });
    expect(atualizado?.percentualDesconto).toBe("25.00");
  });

  it("gera slug do nome no inserir e permite buscarPorSlug", async () => {
    const p = await repo.inserir(nova({ nome: "Plano Conforto Premium" }));
    planoIds.push(p.id);

    expect(p.slug).toBe("plano-conforto-premium");

    const achado = await repo.buscarPorSlug("plano-conforto-premium");
    expect(achado?.id).toBe(p.id);
    expect(await repo.buscarPorSlug("inexistente-xyz")).toBeNull();
  });

  it("resolve colisão de slug com sufixo numérico", async () => {
    const a = await repo.inserir(nova({ nome: "Plano Colisao" }));
    const b = await repo.inserir(nova({ nome: "Plano Colisao" }));
    planoIds.push(a.id, b.id);

    expect(a.slug).toBe("plano-colisao");
    expect(b.slug).toBe("plano-colisao-1");
  });

  it("atualizar com novo nome regenera o slug", async () => {
    const p = await repo.inserir(nova({ nome: "Nome Antigo" }));
    planoIds.push(p.id);
    expect(p.slug).toBe("nome-antigo");

    const atualizado = await repo.atualizar(p.id, { nome: "Nome Novo" });
    expect(atualizado?.slug).toBe("nome-novo");
  });

  it("buscarPorId, listarTodos e definirPreapprovalPlanIdMp", async () => {
    const ativo = await repo.inserir(nova({ ativo: true }));
    const inativo = await repo.inserir(nova({ ativo: false }));
    planoIds.push(ativo.id, inativo.id);

    const achado = await repo.buscarPorId(ativo.id);
    expect(achado?.id).toBe(ativo.id);
    expect(await repo.buscarPorId("00000000-0000-0000-0000-000000000000")).toBeNull();

    const todos = await repo.listarTodos();
    const ids = todos.map((p) => p.id);
    expect(ids).toContain(ativo.id);
    expect(ids).toContain(inativo.id);

    await repo.definirPreapprovalPlanIdMp(ativo.id, "plan-mp-xyz");
    const depois = await repo.buscarPorId(ativo.id);
    expect(depois?.preapprovalPlanIdMp).toBe("plan-mp-xyz");
  });
});
