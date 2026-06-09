import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("gerarPreventivasDevidas (integração)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let gerarPreventivasDevidas: typeof import("@/assinatura/preventiva-geracao").gerarPreventivasDevidas;
  let criarRepo: typeof import("@/assinatura/preventiva-geracao-drizzle").criarPreventivaGeracaoRepoDrizzle;

  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let assinaturaIds: string[] = [];

  const endereco = { logradouro: "Rua A", numero: "1", cidade: "SP", uf: "SP" };

  async function seedAssinaturaAtiva(opts: {
    inicio: Date;
    preventivasPorAno: number;
    categorias: ("ELETRICA" | "PINTURA" | "DRYWALL")[];
  }) {
    const r = Math.random().toString(36).slice(2, 8);
    const [c] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: `1199${r}`, endereco })
      .returning({ id: schema.cliente.id });
    clienteIds.push(c.id);

    const [p] = await dbRaw
      .insert(schema.plano)
      .values({
        nome: `Plano ${r}`,
        preco: "99.90",
        preventivasPorAno: opts.preventivasPorAno,
        categoriasPreventiva: opts.categorias,
      })
      .returning({ id: schema.plano.id });
    planoIds.push(p.id);

    const [a] = await dbRaw
      .insert(schema.assinatura)
      .values({
        clienteId: c.id,
        planoId: p.id,
        status: "ATIVA",
        inicio: opts.inicio,
      })
      .returning({ id: schema.assinatura.id });
    assinaturaIds.push(a.id);
    return { clienteId: c.id, planoId: p.id, assinaturaId: a.id };
  }

  async function osDaAssinatura(assinaturaId: string) {
    const { eq } = await import("drizzle-orm");
    return dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.assinaturaId, assinaturaId));
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    gerarPreventivasDevidas = (
      await import("@/assinatura/preventiva-geracao")
    ).gerarPreventivasDevidas;
    criarRepo = (
      await import("@/assinatura/preventiva-geracao-drizzle")
    ).criarPreventivaGeracaoRepoDrizzle;
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (assinaturaIds.length) {
      const oss = await dbRaw
        .select({ id: schema.ordemServico.id, sol: schema.ordemServico.solicitacaoId })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.assinaturaId, assinaturaIds));
      if (oss.length) {
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, oss.map((o) => o.id)));
        await dbRaw
          .delete(schema.ordemServico)
          .where(inArray(schema.ordemServico.id, oss.map((o) => o.id)));
        await dbRaw
          .delete(schema.solicitacao)
          .where(inArray(schema.solicitacao.id, oss.map((o) => o.sol)));
      }
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.id, assinaturaIds));
    }
    if (planoIds.length)
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    if (clienteIds.length)
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    clienteIds = [];
    planoIds = [];
    assinaturaIds = [];
  });

  it("gera 1 OS PREVENTIVA por categoria do plano, AGENDADA e sem custo", async () => {
    const { assinaturaId } = await seedAssinaturaAtiva({
      inicio: new Date("2026-02-01T00:00:00Z"),
      preventivasPorAno: 4, // a cada 3 meses
      categorias: ["ELETRICA", "PINTURA"],
    });
    const hoje = new Date("2026-06-08T00:00:00Z");

    const res = await gerarPreventivasDevidas(criarRepo(dbRaw), hoje);
    expect(res.geradas).toBe(2);

    const oss = await osDaAssinatura(assinaturaId);
    expect(oss).toHaveLength(2);
    for (const os of oss) {
      expect(os.tipo).toBe("PREVENTIVA");
      expect(os.estado).toBe("AGENDADA");
      expect(os.tecnicoId).toBeNull();
    }
    expect(oss.map((o) => o.categoria).sort()).toEqual(["ELETRICA", "PINTURA"]);
  });

  it("é idempotente: rodar 2x no mesmo dia não duplica OS", async () => {
    const { assinaturaId } = await seedAssinaturaAtiva({
      inicio: new Date("2026-02-01T00:00:00Z"),
      preventivasPorAno: 4,
      categorias: ["ELETRICA", "PINTURA"],
    });
    const hoje = new Date("2026-06-08T00:00:00Z");
    const repo = criarRepo(dbRaw);

    await gerarPreventivasDevidas(repo, hoje);
    const segunda = await gerarPreventivasDevidas(repo, hoje);

    expect(segunda.geradas).toBe(0);
    expect(await osDaAssinatura(assinaturaId)).toHaveLength(2);
  });

  it("não gera quando a cadência ainda não venceu", async () => {
    const { assinaturaId } = await seedAssinaturaAtiva({
      inicio: new Date("2026-05-20T00:00:00Z"),
      preventivasPorAno: 4,
      categorias: ["ELETRICA"],
    });
    const hoje = new Date("2026-06-08T00:00:00Z");

    const res = await gerarPreventivasDevidas(criarRepo(dbRaw), hoje);
    expect(res.geradas).toBe(0);
    expect(await osDaAssinatura(assinaturaId)).toHaveLength(0);
  });

  it("conta a cadência da CONCLUSÃO real da última preventiva (não do agendamento)", async () => {
    // Assinatura antiga, mas a última preventiva só foi concluída há ~3 meses:
    // a próxima vence agora (concluída + 3 meses), não conta do início.
    const { assinaturaId } = await seedAssinaturaAtiva({
      inicio: new Date("2025-06-01T00:00:00Z"),
      preventivasPorAno: 4, // a cada 3 meses
      categorias: ["ELETRICA"],
    });
    // Preventiva anterior: agendada bem antes, concluída há ~3 meses.
    const [solPrev] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: Math.random().toString(36).slice(2, 10),
        clienteId: clienteIds[clienteIds.length - 1],
        categorias: ["ELETRICA"],
        endereco,
        origem: "PREVENTIVA",
      })
      .returning({ id: schema.solicitacao.id });
    const [osPrev] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: solPrev.id,
        tipo: "PREVENTIVA",
        estado: "CONCLUIDA",
        categoria: "ELETRICA",
        assinaturaId,
        agendadoPara: new Date("2026-01-01T00:00:00Z"),
      })
      .returning({ id: schema.ordemServico.id });
    await dbRaw.insert(schema.transicaoOs).values({
      osId: osPrev.id,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "tecnico@dbg.test",
      em: new Date("2026-03-08T00:00:00Z"), // concluída há ~3 meses
    });

    const hoje = new Date("2026-06-08T00:00:00Z");
    const res = await gerarPreventivasDevidas(criarRepo(dbRaw), hoje);

    expect(res.geradas).toBe(1);
    const agendadas = (await osDaAssinatura(assinaturaId)).filter(
      (o) => o.estado === "AGENDADA",
    );
    expect(agendadas).toHaveLength(1);
    // próxima = conclusão (08/03) + 3 meses = 08/06
    expect(agendadas[0].agendadoPara?.toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
  });
});
