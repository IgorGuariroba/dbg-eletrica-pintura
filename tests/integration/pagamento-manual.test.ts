import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registrarPagamentoManual } from "@/pagamento/registrar-manual";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("registrarPagamentoManual Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let deps: {
    pagamentoRepo: import("@/pagamento/pagamento-repo").PagamentoRepo;
    transicaoRepo: import("@/operacao/transicao-repo").TransicaoRepo;
  };
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];

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
        estado: estado as any,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id as string };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
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

  async function buscarPagamento(osId: string) {
    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.pagamento)
      .where(eq(schema.pagamento.osId, osId))
      .limit(1);
    return row;
  }

  it("tracer bullet — manual transita sem webhook e salva observacao", async () => {
    const { osId } = await seedOs("CONCLUIDA");
    const obs = "Pago em dinheiro vivo";

    const resultado = await registrarPagamentoManual(
      osId,
      {
        valor: "150.00",
        metodo: "DINHEIRO",
        observacao: obs,
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );

    expect(resultado.ok).toBe(true);
    expect(await estadoDe(osId)).toBe("PAGA");

    const pag = await buscarPagamento(osId);
    expect(pag).toBeDefined();
    expect(pag.metodo).toBe("DINHEIRO");
    expect(pag.valor).toBe("150.00");
    expect(pag.status).toBe("approved");
    expect(pag.observacao).toBe(obs);
    expect(pag.paymentId).toMatch(/^manual-/);
  });

  it("registra ator e timestamp correto na transicao", async () => {
    const { osId } = await seedOs("CONCLUIDA");
    const dataHora = new Date("2026-06-01T10:00:00Z");

    const resultado = await registrarPagamentoManual(
      osId,
      {
        valor: "150.00",
        metodo: "DINHEIRO",
        atorEmail: "tecnico@dbg.test",
      },
      deps,
      dataHora
    );

    expect(resultado.ok).toBe(true);

    const { eq } = await import("drizzle-orm");
    const [trans] = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId))
      .limit(1);

    expect(trans).toBeDefined();
    expect(trans.atorEmail).toBe("tecnico@dbg.test");
    expect(trans.estadoAnterior).toBe("CONCLUIDA");
    expect(trans.estadoNovo).toBe("PAGA");
    expect(new Date(trans.em).toISOString()).toBe(dataHora.toISOString());
  });

  it("impede pagamento se OS nao estiver no estado CONCLUIDA", async () => {
    const { osId } = await seedOs("EM_EXECUCAO");

    const resultado = await registrarPagamentoManual(
      osId,
      {
        valor: "150.00",
        metodo: "DINHEIRO",
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toBeDefined();
    expect(await estadoDe(osId)).toBe("EM_EXECUCAO");

    // Nao deve ter gravado linha de pagamento
    const pag = await buscarPagamento(osId);
    expect(pag).toBeUndefined();
  });

  it("rejeita valores invalidos e metodos de pagamento manuais nao homologados", async () => {
    const { osId } = await seedOs("CONCLUIDA");

    // Valor <= 0
    const res1 = await registrarPagamentoManual(
      osId,
      {
        valor: "0.00",
        metodo: "DINHEIRO",
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );
    expect(res1.ok).toBe(false);
    expect(res1.erro).toMatch(/valor/i);

    // Método nao cadastrado (e.g. CARTAO)
    const res2 = await registrarPagamentoManual(
      osId,
      {
        valor: "100.00",
        metodo: "CARTAO",
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );
    expect(res2.ok).toBe(false);
    expect(res2.erro).toMatch(/m[ée]todo/i);

    // Estado da OS nao deve ter mudado e nenhum pagamento gravado
    expect(await estadoDe(osId)).toBe("CONCLUIDA");
    expect(await buscarPagamento(osId)).toBeUndefined();
  });

  it("idempotencia: mesma OS nao pode receber multiplos pagamentos", async () => {
    const { osId } = await seedOs("CONCLUIDA");

    const res1 = await registrarPagamentoManual(
      osId,
      {
        valor: "150.00",
        metodo: "DINHEIRO",
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );
    expect(res1.ok).toBe(true);

    const res2 = await registrarPagamentoManual(
      osId,
      {
        valor: "150.00",
        metodo: "DINHEIRO",
        atorEmail: "tecnico@dbg.test",
      },
      deps
    );
    expect(res2.ok).toBe(false); // Ja esta paga, ou transicao ja ocorreu
  });
});
