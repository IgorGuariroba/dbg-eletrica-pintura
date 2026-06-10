import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("HistoricoRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/portal/historico-repo").HistoricoRepo;
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let servicoIds: string[] = [];
  let clientesPorWhatsapp: Map<string, typeof schema.cliente.$inferSelect>;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (await import("@/portal/historico-repo-drizzle")).criarHistoricoRepoDrizzle(dbRaw);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    servicoIds = [];
    clientesPorWhatsapp = new Map();
  });

  afterEach(async () => {
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

    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function semearSolicitacao(over: {
    whatsapp?: string;
    token?: string;
    criadoEm?: Date;
    estado?: "NOVA" | "ORCADA" | "AGENDADA";
  } = {}) {
    const rand = Math.random().toString(36).slice(2, 10);
    const whatsapp = over.whatsapp ?? `55119${Math.floor(10000000 + Math.random() * 90000000)}`;
    let cli = clientesPorWhatsapp.get(whatsapp);
    if (!cli) {
      [cli] = await dbRaw
        .insert(schema.cliente)
        .values({
          nome: `Cliente `,
          whatsapp,
        })
        .returning();
      clienteIds.push(cli.id);
      clientesPorWhatsapp.set(whatsapp, cli);
    }

    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: over.token ?? `portal-${rand}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
        criadoEm: over.criadoEm ?? new Date(),
      })
      .returning();
    solicitacaoIds.push(sol.id);

    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: over.estado ?? "NOVA",
        categoria: "ELETRICA",
      })
      .returning();

    return { cliente: cli, solicitacao: sol, os };
  }

  it("inclui técnico, orçamento mais recente e itens da OS", async () => {
    const { solicitacao, os } = await semearSolicitacao({
      whatsapp: "5511999990007",
      token: "portal-orcamento",
      estado: "ORCADA",
    });
    const rand = Math.random().toString(36).slice(2, 10);
    const [tecnico] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: "Técnica Portal",
        email: `tecnica-${rand}@dbg.test`,
        isTecnico: true,
        modulos: [],
        fotoUrl: "https://cdn.test/foto.jpg",
        slug: "tecnica-portal",
      })
      .returning();
    membroIds.push(tecnico.id);
    await dbRaw
      .update(schema.ordemServico)
      .set({ tecnicoId: tecnico.id })
      .where((await import("drizzle-orm")).eq(schema.ordemServico.id, os.id));

    const [servico] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: "Instalação portal",
        categoria: "ELETRICA",
        precoBase: "100",
        unidade: "PONTO",
        prazoGarantiaMeses: 3,
        ativo: true,
      })
      .returning();
    servicoIds.push(servico.id);

    await dbRaw.insert(schema.orcamento).values({
      osId: os.id,
      tokenAprovacao: `antigo-${rand}`,
      totalMaoDeObra: "50",
      totalDeslocamento: "10",
      total: "60",
      validoAte: new Date("2026-02-01T10:00:00.000Z"),
      criadoEm: new Date("2026-01-01T10:00:00.000Z"),
    });
    const [orcamento] = await dbRaw
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `recente-${rand}`,
        totalMaoDeObra: "200",
        totalDeslocamento: "25",
        total: "225",
        validoAte: new Date("2026-02-10T10:00:00.000Z"),
        criadoEm: new Date("2026-01-02T10:00:00.000Z"),
      })
      .returning();
    await dbRaw.insert(schema.orcamentoItem).values({
      orcamentoId: orcamento.id,
      servicoId: servico.id,
      quantidade: "2",
      precoUnitario: "100",
      subtotal: "200",
    });

    const detalhe = await repo.carregarSolicitacao(
      solicitacao.id,
      "5511999990007",
    );

    expect(detalhe?.ordens[0]?.tecnico).toEqual({
      id: tecnico.id,
      nome: "Técnica Portal",
      fotoUrl: "https://cdn.test/foto.jpg",
      slug: "tecnica-portal",
    });
    expect(detalhe?.ordens[0]?.orcamento).toMatchObject({
      total: "225.00",
      totalDeslocamento: "25.00",
      itens: [
        {
          nome: "Instalação portal",
          quantidade: "2.00",
          precoUnitario: "100.00",
          subtotal: "200.00",
        },
      ],
    });
  });

  it("pagina histórico em blocos de 20 mantendo total", async () => {
    const whatsapp = "5511999990006";
    // Primeira sequencial (cria e cacheia o cliente no Map); demais em
    // paralelo — 25 seeds sequenciais via proxy HTTP estouram o testTimeout
    // quando o CI roda com workers em paralelo.
    await semearSolicitacao({
      whatsapp,
      token: "portal-paginada-0",
      criadoEm: new Date(Date.UTC(2026, 0, 1, 10, 0, 0)),
    });
    await Promise.all(
      Array.from({ length: 24 }, (_, j) =>
        semearSolicitacao({
          whatsapp,
          token: `portal-paginada-${j + 1}`,
          criadoEm: new Date(Date.UTC(2026, 0, j + 2, 10, 0, 0)),
        }),
      ),
    );

    const primeira = await repo.listar(whatsapp, { limit: 20, offset: 0 });
    const segunda = await repo.listar(whatsapp, { limit: 20, offset: 20 });

    expect(primeira.total).toBe(25);
    expect(primeira.itens).toHaveLength(20);
    expect(primeira.itens[0]?.protocolo).toBe("PORTAL-P");
    expect(segunda.total).toBe(25);
    expect(segunda.itens).toHaveLength(5);
  });

  it("carrega Solicitação somente para o WhatsApp dono", async () => {
    const dono = await semearSolicitacao({
      whatsapp: "5511999990004",
      token: "portal-detalhe-dono",
      estado: "ORCADA",
    });

    const detalheDono = await repo.carregarSolicitacao(
      dono.solicitacao.id,
      "5511999990004",
    );
    const detalheOutro = await repo.carregarSolicitacao(
      dono.solicitacao.id,
      "5511999990005",
    );

    expect(detalheDono?.id).toBe(dono.solicitacao.id);
    expect(detalheDono?.ordens[0]?.id).toBe(dono.os.id);
    expect(detalheOutro).toBeNull();
  });

  it("não lista Solicitações de outro WhatsApp", async () => {
    const dono = await semearSolicitacao({
      whatsapp: "5511999990002",
      token: "portal-dono",
      criadoEm: new Date("2026-01-12T10:00:00.000Z"),
    });
    await semearSolicitacao({
      whatsapp: "5511999990003",
      token: "portal-outro",
      criadoEm: new Date("2026-01-13T10:00:00.000Z"),
    });

    const pagina = await repo.listar("5511999990002", { limit: 20, offset: 0 });

    expect(pagina.total).toBe(1);
    expect(pagina.itens.map((s) => s.id)).toEqual([dono.solicitacao.id]);
  });

  it("lista Solicitações do cliente mais recentes primeiro com OS filhas", async () => {
    const whatsapp = "5511999990001";
    const antiga = await semearSolicitacao({
      whatsapp,
      token: "portal-antiga",
      criadoEm: new Date("2026-01-10T10:00:00.000Z"),
      estado: "NOVA",
    });
    const recente = await semearSolicitacao({
      whatsapp,
      token: "portal-recente",
      criadoEm: new Date("2026-01-12T10:00:00.000Z"),
      estado: "AGENDADA",
    });

    const pagina = await repo.listar(whatsapp, { limit: 20, offset: 0 });

    expect(pagina.total).toBe(2);
    expect(pagina.itens.map((s) => s.id)).toEqual([
      recente.solicitacao.id,
      antiga.solicitacao.id,
    ]);
    expect(pagina.itens[0]).toMatchObject({
      protocolo: "PORTAL-R",
      cidade: "São Paulo",
      uf: "SP",
    });
    expect(pagina.itens[0]?.ordens).toEqual([
      expect.objectContaining({
        id: recente.os.id,
        categoria: "ELETRICA",
        estado: "AGENDADA",
      }),
    ]);
  });
});
