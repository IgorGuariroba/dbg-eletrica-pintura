import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("AprovacaoRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/aprovacao-repo").AprovacaoRepo;
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let servicoIds: string[] = [];

  // Cria Solicitação + 1 OS ORÇADA com orçamento. validadeDias controla a
  // validade (negativo = já vencido).
  async function seedOrcada(validadeDias: number) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const token = `tok-${r}`;
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token,
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
        estado: "ORCADA",
      })
      .returning();
    const [srv] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: `Srv ${r}`,
        categoria: "ELETRICA",
        precoBase: "100",
        unidade: "PONTO",
        prazoGarantiaMeses: 3,
        ativo: true,
      })
      .returning();
    const [orc] = await dbRaw
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `apr-${r}`,
        totalMaterial: "0",
        totalMaoDeObra: "200",
        totalDeslocamento: "12",
        total: "212",
        validoAte: new Date(Date.now() + validadeDias * 86_400_000),
      })
      .returning();
    await dbRaw.insert(schema.orcamentoItem).values({
      orcamentoId: orc.id,
      servicoId: srv.id,
      quantidade: "2",
      precoUnitario: "100",
      subtotal: "200",
    });
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    servicoIds.push(srv.id);
    return { token, osId: os.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (await import("@/operacao/aprovacao-repo-drizzle")).criarAprovacaoRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
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
    if (servicoIds.length) {
      await dbRaw
        .delete(schema.servico)
        .where(inArray(schema.servico.id, servicoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("carregarPorToken traz Solicitação, OS e breakdown do orçamento", async () => {
    const { token, osId } = await seedOrcada(7);
    const view = await repo.carregarPorToken(token);
    expect(view?.token).toBe(token);
    const os = view?.ordens.find((o) => o.id === osId);
    expect(os?.estado).toBe("ORCADA");
    expect(os?.orcamento?.total).toBe("212.00");
    expect(os?.orcamento?.itens).toHaveLength(1);
    expect(Number(os?.orcamento?.itens[0]?.subtotal)).toBe(200);
  });

  it("token inexistente retorna null", async () => {
    expect(await repo.carregarPorToken("nao-existe")).toBeNull();
  });

  it("expirarVencidas transita ORÇADA vencida para EXPIRADA", async () => {
    const { token, osId } = await seedOrcada(-1);
    await repo.expirarVencidas(token, new Date());
    const view = await repo.carregarPorToken(token);
    expect(view?.ordens.find((o) => o.id === osId)?.estado).toBe("EXPIRADA");
  });

  it("aprovar transita ORÇADA→APROVADA e grava assinatura (token+IP)", async () => {
    const { token, osId } = await seedOrcada(7);
    const ok = await repo.aprovar(token, osId, { token, ip: "9.9.9.9" });
    expect(ok).toBe(true);

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("APROVADA");
    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.osId, osId))
      .limit(1);
    expect(orc.assinaturaIp).toBe("9.9.9.9");
    expect(orc.assinaturaToken).toBe(token);
    expect(orc.aprovadoEm).not.toBeNull();
  });

  it("não aprova OS usando o token de outra Solicitação", async () => {
    const a = await seedOrcada(7);
    const b = await seedOrcada(7);
    const ok = await repo.aprovar(b.token, a.osId, { token: b.token, ip: "1.1.1.1" });
    expect(ok).toBe(false);
  });

  it("não aprova orçamento já vencido", async () => {
    const { token, osId } = await seedOrcada(-1);
    const ok = await repo.aprovar(token, osId, { token, ip: "1.1.1.1" });
    expect(ok).toBe(false);
  });

  it("rejeitar transita ORÇADA→REJEITADA e grava motivo", async () => {
    const { token, osId } = await seedOrcada(7);
    const ok = await repo.rejeitar(token, osId, "achei caro");
    expect(ok).toBe(true);
    const { eq } = await import("drizzle-orm");
    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.osId, osId))
      .limit(1);
    expect(orc.motivoRejeicao).toBe("achei caro");
    expect(orc.rejeitadoEm).not.toBeNull();
  });
});
