import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MetricasPublicasQuery } from "@/marketing/landing/metricas-publicas-query";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("MetricasPublicasQuery Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let query: MetricasPublicasQuery;
  const solicitacaoIds: string[] = [];
  const clienteIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarMetricasPublicasQueryDrizzle } = await import(
      "@/marketing/landing/metricas-publicas-query-drizzle"
    );
    dbRaw = dbMod.db;
    query = criarMetricasPublicasQueryDrizzle(dbMod.db);
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      const oss = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = oss.map((o) => o.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.avaliacao)
          .where(inArray(schema.avaliacao.osId, osIds));
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
        await dbRaw
          .delete(schema.ordemServico)
          .where(inArray(schema.ordemServico.id, osIds));
      }
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  // Semeia OS concluída (com transição p/ CONCLUIDA) e avaliação opcional.
  async function seedOsConcluida(opts?: {
    nota?: number;
    invalida?: boolean;
  }): Promise<void> {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    clienteIds.push(cli.id);
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["PINTURA"],
        fotosUrls: [],
        endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
      })
      .returning();
    solicitacaoIds.push(sol.id);
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        categoria: "PINTURA",
        estado: "CONCLUIDA",
      })
      .returning();
    await dbRaw.insert(schema.transicaoOs).values({
      osId: os.id,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "tecnico@dbg.test",
    });
    if (opts?.nota != null) {
      await dbRaw.insert(schema.avaliacao).values({
        osId: os.id,
        nota: opts.nota,
        comentarioOs: `Comentário ${r}`,
        atorToken: `tok-${r}`,
        ip: "127.0.0.1",
        invalida: opts.invalida ?? false,
      });
    }
  }

  it("conta OS concluídas e avaliações válidas de forma monotônica", async () => {
    const antes = await query.obter();

    await seedOsConcluida({ nota: 5 });
    await seedOsConcluida();

    const depois = await query.obter();
    expect(depois.osConcluidas).toBeGreaterThanOrEqual(antes.osConcluidas + 2);
    expect(depois.totalAvaliacoes).toBeGreaterThanOrEqual(
      antes.totalAvaliacoes + 1,
    );
    expect(depois.notaMedia).not.toBeNull();
    expect(depois.notaMedia!).toBeGreaterThanOrEqual(1);
    expect(depois.notaMedia!).toBeLessThanOrEqual(5);
  });

  it("avaliação invalidada não entra no total nem na média", async () => {
    const antes = await query.obter();
    await seedOsConcluida({ nota: 1, invalida: true });
    const depois = await query.obter();
    expect(depois.totalAvaliacoes).toBe(antes.totalAvaliacoes);
  });
});
