import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DadosPagamento } from "@/pagamento/webhook";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("processarPagamento (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let processarPagamento: typeof import("@/pagamento/processar-pagamento").processarPagamento;
  let deps: {
    pagamentoRepo: import("@/pagamento/pagamento-repo").PagamentoRepo;
    transicaoRepo: import("@/operacao/transicao-repo").TransicaoRepo;
  };
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  let paymentIds: string[] = [];

  type TipoOs = "NORMAL" | "EXPRESS" | "COMPLEMENTAR" | "PREVENTIVA" | "GARANTIA";

  async function seedOs(estado: string, tipo: TipoOs = "NORMAL") {
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
        tipo,
        // biome-ignore lint/suspicious/noExplicitAny: estado de teste
        estado: estado as any,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id as string };
  }

  function dados(osId: string, status = "approved", paymentId?: string): DadosPagamento {
    const id = paymentId ?? `pay-${Math.random().toString(36).slice(2, 10)}`;
    paymentIds.push(id);
    return {
      paymentId: id,
      status,
      valor: "212.00",
      metodo: "pix",
      osIds: [osId],
    };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    processarPagamento = (await import("@/pagamento/processar-pagamento"))
      .processarPagamento;
    deps = {
      pagamentoRepo: (
        await import("@/pagamento/pagamento-repo-drizzle")
      ).criarPagamentoRepoDrizzle(dbMod.db),
      transicaoRepo: (
        await import("@/operacao/transicao-repo-drizzle")
      ).criarTransicaoRepoDrizzle(dbMod.db),
    };
  });

  beforeEach(() => {
    solicitacaoIds = [];
    clienteIds = [];
    paymentIds = [];
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
        // Pagamento referencia a OS (FK restrict): apagar antes da OS.
        await dbRaw
          .delete(schema.pagamento)
          .where(inArray(schema.pagamento.osId, osIds));
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
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
  });

  async function estadoDe(osId: string): Promise<string> {
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    return os.estado;
  }

  async function linhasPagamento(paymentId: string): Promise<number> {
    const { eq } = await import("drizzle-orm");
    const rows = await dbRaw
      .select({ osId: schema.pagamento.osId })
      .from(schema.pagamento)
      .where(eq(schema.pagamento.paymentId, paymentId));
    return rows.length;
  }

  it("pagamento aprovado transita CONCLUIDA → PAGA e registra a linha", async () => {
    const { osId } = await seedOs("CONCLUIDA");
    const d = dados(osId);

    const out = await processarPagamento(d, deps);

    expect(out.transitadas).toEqual([osId]);
    expect(await estadoDe(osId)).toBe("PAGA");
    expect(await linhasPagamento(d.paymentId)).toBe(1);
  });

  it("webhook duplicado não duplica linha nem transição", async () => {
    const { osId } = await seedOs("CONCLUIDA");
    const d = dados(osId);

    const primeira = await processarPagamento(d, deps);
    const segunda = await processarPagamento(d, deps);

    expect(primeira.transitadas).toEqual([osId]);
    expect(segunda.transitadas).toEqual([]);
    expect(await linhasPagamento(d.paymentId)).toBe(1);

    const { eq } = await import("drizzle-orm");
    const transicoes = await dbRaw
      .select({ id: schema.transicaoOs.id })
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(transicoes).toHaveLength(1);
  });

  it("pagamento rejeitado não altera o estado da OS nem registra linha", async () => {
    const { osId } = await seedOs("CONCLUIDA");
    const d = dados(osId, "rejected");

    const out = await processarPagamento(d, deps);

    expect(out.transitadas).toEqual([]);
    expect(await estadoDe(osId)).toBe("CONCLUIDA");
    expect(await linhasPagamento(d.paymentId)).toBe(0);
  });

  it("OS PREVENTIVA não transita para PAGA mesmo com pagamento aprovado", async () => {
    const { osId } = await seedOs("CONCLUIDA", "PREVENTIVA");
    const d = dados(osId);

    const out = await processarPagamento(d, deps);

    expect(out.transitadas).toEqual([]);
    expect(await estadoDe(osId)).toBe("CONCLUIDA");
  });
});
