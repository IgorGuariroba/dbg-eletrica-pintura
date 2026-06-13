import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { criarConfigRemarketingRepoDrizzle } from "@/marketing/remarketing/config-repo";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ConfigRemarketingRepoDrizzle (Slice A)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: ReturnType<typeof criarConfigRemarketingRepoDrizzle>;

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
    repo = criarConfigRemarketingRepoDrizzle(db);
  });

  afterEach(async () => {
    // Limpa os registros de configuração para não afetar outros testes
    await db.delete(schema.configRemarketing);
  });

  it("listar() retorna 4 gatilhos com os defaults se a tabela estiver vazia", async () => {
    const configs = await repo.listar();
    expect(configs).toHaveLength(4);

    const validade = configs.find((c) => c.gatilho === "validade_orcamento");
    expect(validade).toBeDefined();
    expect(validade!.ativo).toBe(true);
    expect(validade!.prazosDias).toEqual([7]);
    expect(validade!.templateId).toBeNull();

    const lembrete = configs.find((c) => c.gatilho === "lembrete_orcamento");
    expect(lembrete).toBeDefined();
    expect(lembrete!.ativo).toBe(true);
    expect(lembrete!.prazosDias).toEqual([3, 6]);
    expect(lembrete!.templateId).toBe("orcamento_expirando");
  });

  it("salvar() persiste e listar() mescla com overrides corretamente", async () => {
    // Altera a validade do orçamento para 10 dias, inativo, e muda o template do lembrete
    await repo.salvar("validade_orcamento", {
      ativo: false,
      prazosDias: [10],
      templateId: "override_val",
    });

    const configs = await repo.listar();
    const validade = configs.find((c) => c.gatilho === "validade_orcamento")!;
    expect(validade.ativo).toBe(false);
    expect(validade.prazosDias).toEqual([10]);
    expect(validade.templateId).toBe("override_val");

    // Lembrete deve continuar com os padrões intactos
    const lembrete = configs.find((c) => c.gatilho === "lembrete_orcamento")!;
    expect(lembrete.ativo).toBe(true);
    expect(lembrete.prazosDias).toEqual([3, 6]);
  });

  it("obterValidadeDias() retorna o valor configurado ou fallback 7", async () => {
    expect(await repo.obterValidadeDias()).toBe(7);

    await repo.salvar("validade_orcamento", {
      ativo: true,
      prazosDias: [5],
      templateId: null,
    });

    expect(await repo.obterValidadeDias()).toBe(5);
  });
});
