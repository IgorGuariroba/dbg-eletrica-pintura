import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Orçamento Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let orcRepo: import("@/operacao/orcamento-repo").OrcamentoRepo;
  let montar: typeof import("@/operacao/orcamento").montarOrcamento;
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let servicoIds: string[] = [];

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedServico(
    categoria: "ELETRICA" | "PINTURA",
    precoBase: string,
  ) {
    const r = Math.random().toString(36).slice(2, 10);
    const [s] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: `Srv ${r}`,
        categoria,
        precoBase,
        unidade: "PONTO",
        prazoGarantiaMeses: 3,
        ativo: true,
      })
      .returning();
    servicoIds.push(s.id);
    return s.id;
  }

  async function seedOsAtribuida(tecnicoId: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "NOVA",
        tecnicoId,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    orcRepo = (await import("@/operacao/orcamento-repo-drizzle")).criarOrcamentoRepoDrizzle(dbMod.db);
    montar = (await import("@/operacao/orcamento")).montarOrcamento;
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    servicoIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      const osRows = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.orcamento)
          .where(inArray(schema.orcamento.osId, osIds));
      }
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
    if (servicoIds.length) {
      await dbRaw
        .delete(schema.servico)
        .where(inArray(schema.servico.id, servicoIds));
    }
    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }
  });

  it("montar persiste orçamento + itens e transita OS para ORÇADA", async () => {
    const tec = await seedTecnico();
    const srv = await seedServico("ELETRICA", "100");
    const osId = await seedOsAtribuida(tec);

    const r = await montar(
      {
        osId,
        itens: [{ servicoId: srv, quantidade: "2" }],
        km: 20,
      },
      { membroId: tec, isTecnico: true },
      { precoLitro: "6", kmPorLitro: "10" },
      orcRepo,
    );

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("ORCADA");

    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.id, r.id))
      .limit(1);
    expect(Number(orc.total)).toBe(212);

    const itens = await dbRaw
      .select()
      .from(schema.orcamentoItem)
      .where(eq(schema.orcamentoItem.orcamentoId, r.id));
    expect(itens).toHaveLength(1);
    expect(Number(itens[0].subtotal)).toBe(200);
  });

  it("segundo orçamento na mesma OS é barrado (estado já não é NOVA)", async () => {
    const tec = await seedTecnico();
    const srv = await seedServico("ELETRICA", "100");
    const osId = await seedOsAtribuida(tec);
    const chamar = () =>
      montar(
        { osId, itens: [{ servicoId: srv, quantidade: "1" }], km: 0 },
        { membroId: tec, isTecnico: true },
        { precoLitro: "6", kmPorLitro: "10" },
        orcRepo,
      );

    await chamar();
    await expect(chamar()).rejects.toMatchObject({ status: 409 });

    // Não sobra orçamento órfão da 2ª tentativa.
    const { eq } = await import("drizzle-orm");
    const orcs = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.osId, osId));
    expect(orcs).toHaveLength(1);
  });
});
