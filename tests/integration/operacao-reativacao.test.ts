import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reativarOs } from "@/operacao/reativacao";
import { criarReativacaoRepoDrizzle } from "@/operacao/reativacao-repo-drizzle";
import { EstadoInvalidoError } from "@/operacao/reativacao-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ReativacaoRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/reativacao-repo").ReativacaoRepo;
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let servicoIds: string[] = [];

  async function seedOs(estado: "REJEITADA" | "EXPIRADA" | "NOVA") {
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
        estado: estado,
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

    // Cria um orçamento para a OS
    const [orc] = await dbRaw
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `apr-${r}`,
        totalMaterial: "0",
        totalMaoDeObra: "200",
        totalDeslocamento: "12",
        total: "212",
        validoAte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Vencido ontem
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

    return { osId: os.id, orcId: orc.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = criarReativacaoRepoDrizzle(dbMod.db);
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
          .delete(schema.orcamentoItem)
          .where(inArray(schema.orcamentoItem.orcamentoId, dbRaw
            .select({ id: schema.orcamento.id })
            .from(schema.orcamento)
            .where(inArray(schema.orcamento.osId, osIds))
          ));
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

  it("reativa OS em REJEITADA alterando estado para ORCADA e extendendo validade do ultimo orcamento", async () => {
    const { osId, orcId } = await seedOs("REJEITADA");
    const usuario = { membroId: "m-123", role: "admin_raiz", modulos: [] };
    const agora = new Date();

    await reativarOs(osId, usuario, "Cliente quer reconsiderar", repo, agora);

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);

    expect(os.estado).toBe("ORCADA");
    expect(os.metadados).toEqual(
      expect.objectContaining({
        reativacoes: [
          {
            membroId: "m-123",
            motivo: "Cliente quer reconsiderar",
            deEstado: "REJEITADA",
            em: agora.toISOString(),
          },
        ],
      })
    );

    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.id, orcId))
      .limit(1);

    const dataEsperadaValidade = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Margem de 2 segundos para comparar datas devido à precisão do BD
    expect(Math.abs(orc.validoAte.getTime() - dataEsperadaValidade.getTime())).toBeLessThan(2000);
  });

  it("lanca EstadoInvalidoError se a OS no banco de dados estiver em estado NOVA", async () => {
    const { osId } = await seedOs("NOVA");
    const usuario = { membroId: "m-123", role: "admin_raiz", modulos: [] };

    await expect(
      reativarOs(osId, usuario, "reativar", repo),
    ).rejects.toBeInstanceOf(EstadoInvalidoError);
  });
});
