import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PlanoRepo } from "@/financeiro/planos/plano-repo";

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
});
