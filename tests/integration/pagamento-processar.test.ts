import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DadosPagamento } from "@/pagamento/webhook";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("processarPagamento (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let processarPagamento: typeof import("@/pagamento/processar-pagamento").processarPagamento;
  let deps: import("@/pagamento/processar-pagamento").ProcessarDeps;
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
      // Suprime o dispatch de documentos (R2/e-mail) — isola o teste.
      notificarTransicao: () => {},
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

  function dadosMulti(osIds: string[], status = "approved", paymentId?: string): DadosPagamento {
    const id = paymentId ?? `pay-${Math.random().toString(36).slice(2, 10)}`;
    paymentIds.push(id);
    return {
      paymentId: id,
      status,
      valor: "450.00",
      metodo: "pix",
      osIds,
    };
  }

  it("comportamento 9: webhook consolidado transita N OS", async () => {
    const { osId: osId1 } = await seedOs("CONCLUIDA");
    const { osId: osId2 } = await seedOs("CONCLUIDA");
    const d = dadosMulti([osId1, osId2]);

    const out = await processarPagamento(d, deps);

    expect(out.transitadas).toEqual(expect.arrayContaining([osId1, osId2]));
    expect(await estadoDe(osId1)).toBe("PAGA");
    expect(await estadoDe(osId2)).toBe("PAGA");
    expect(await linhasPagamento(d.paymentId)).toBe(2);
  });

  it("comportamento 10: pagamento parcial não interfere", async () => {
    const { osId: osId1 } = await seedOs("CONCLUIDA");
    const { osId: osId2 } = await seedOs("CONCLUIDA");
    const d = dados(osId1);

    const out = await processarPagamento(d, deps);

    expect(out.transitadas).toEqual([osId1]);
    expect(await estadoDe(osId1)).toBe("PAGA");
    expect(await estadoDe(osId2)).toBe("CONCLUIDA");
    expect(await linhasPagamento(d.paymentId)).toBe(1);
  });

  it("comportamento 11: duas individuais em sequência", async () => {
    const { osId: osId1 } = await seedOs("CONCLUIDA");
    const { osId: osId2 } = await seedOs("CONCLUIDA");

    const d1 = dados(osId1);
    const out1 = await processarPagamento(d1, deps);
    expect(out1.transitadas).toEqual([osId1]);

    const d2 = dados(osId2);
    const out2 = await processarPagamento(d2, deps);
    expect(out2.transitadas).toEqual([osId2]);

    expect(await estadoDe(osId1)).toBe("PAGA");
    expect(await estadoDe(osId2)).toBe("PAGA");
    expect(await linhasPagamento(d1.paymentId)).toBe(1);
    expect(await linhasPagamento(d2.paymentId)).toBe(1);
  });

  it("comportamento 12: idempotência consolidada", async () => {
    const { osId: osId1 } = await seedOs("CONCLUIDA");
    const { osId: osId2 } = await seedOs("CONCLUIDA");
    const d = dadosMulti([osId1, osId2]);

    const primeira = await processarPagamento(d, deps);
    const segunda = await processarPagamento(d, deps);

    expect(primeira.transitadas).toEqual(expect.arrayContaining([osId1, osId2]));
    expect(segunda.transitadas).toEqual([]);
    expect(await linhasPagamento(d.paymentId)).toBe(2);
  });

  async function linesPagamento(paymentId: string) {
    return linhasPagamento(paymentId);
  }

  it("pagamento da primeira OS de indicado gera crédito para indicador", async () => {
    const { eq } = await import("drizzle-orm");

    // 1. Cria o cliente indicador (A)
    const [indicador] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: "Indicador Pag",
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
        saldoCredito: "0.00",
      })
      .returning();
    clienteIds.push(indicador.id);

    // 2. Cria o cliente indicado (B) e sua OS
    const { osId } = await seedOs("CONCLUIDA");

    // Pega o ID do cliente B gerado no seed
    const [os] = await dbRaw
      .select({ solicitacaoId: schema.ordemServico.solicitacaoId })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    
    const [sol] = await dbRaw
      .select({ clienteId: schema.solicitacao.clienteId })
      .from(schema.solicitacao)
      .where(eq(schema.solicitacao.id, os.solicitacaoId))
      .limit(1);

    const indicadoId = sol.clienteId;

    // Vincula a indicação
    await dbRaw
      .insert(schema.indicacao)
      .values({
        indicadorId: indicador.id,
        indicadoId,
        descontoAplicado: true,
        creditoGerado: false,
      });

    // 3. Processa o pagamento da primeira OS do indicado
    const d = dados(osId);
    const out = await processarPagamento(d, deps);
    expect(out.transitadas).toEqual([osId]);

    // 4. Verifica se o saldo do indicador foi atualizado para 30.00
    const [indCli] = await dbRaw
      .select({ saldoCredito: schema.cliente.saldoCredito })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, indicador.id))
      .limit(1);

    expect(indCli.saldoCredito).toBe("30.00");

    // 5. Verifica se creditoGerado virou true
    const [ind] = await dbRaw
      .select()
      .from(schema.indicacao)
      .where(eq(schema.indicacao.indicadoId, indicadoId))
      .limit(1);

    expect(ind.creditoGerado).toBe(true);

    // 6. Teste de Idempotência: Se criarmos e pagarmos uma segunda OS para o Cliente B, o saldo do indicador NÃO pode aumentar novamente
    const { osId: osId2 } = await seedOs("CONCLUIDA");
    
    // Atualiza a segunda OS para pertencer à mesma solicitação/cliente
    await dbRaw
      .update(schema.ordemServico)
      .set({ solicitacaoId: os.solicitacaoId })
      .where(eq(schema.ordemServico.id, osId2));

    const d2 = dados(osId2);
    const out2 = await processarPagamento(d2, deps);
    expect(out2.transitadas).toEqual([osId2]);

    const [indCli2] = await dbRaw
      .select({ saldoCredito: schema.cliente.saldoCredito })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, indicador.id))
      .limit(1);

    // O saldo deve permanecer 30.00 (não pode somar +30)
    expect(indCli2.saldoCredito).toBe("30.00");

    // Limpeza da indicação
    await dbRaw.delete(schema.indicacao).where(eq(schema.indicacao.indicadoId, indicadoId));
  });

  it("pagamento approved consome crédito do cliente de forma idempotente", async () => {
    const { eq } = await import("drizzle-orm");

    // 1. Cria o cliente com saldo inicial de R$ 50.00
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: "Cliente Credito",
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
        saldoCredito: "50.00",
      })
      .returning();
    clienteIds.push(cli.id);

    // 2. Cria a OS do cliente
    const { osId } = await seedOs("CONCLUIDA");

    // Atualiza a OS para pertencer ao cliente com crédito
    const [os] = await dbRaw
      .select({ solicitacaoId: schema.ordemServico.solicitacaoId })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);

    await dbRaw
      .update(schema.solicitacao)
      .set({ clienteId: cli.id })
      .where(eq(schema.solicitacao.id, os.solicitacaoId));

    // 3. Processa o pagamento simulando que usou R$ 30.00 de crédito
    const payId = `pay-cred-${Math.random().toString(36).slice(2, 10)}`;
    const d = dados(osId, "approved", payId);
    d.metadata = {
      credito_utilizado: "30.00",
      cliente_id: cli.id,
    };

    const out = await processarPagamento(d, deps);
    expect(out.transitadas).toEqual([osId]);

    // 4. Verifica se o saldo do cliente caiu para 20.00
    const [cliLido] = await dbRaw
      .select({ saldoCredito: schema.cliente.saldoCredito })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, cli.id))
      .limit(1);

    expect(cliLido.saldoCredito).toBe("20.00");

    // 5. Verifica se registrou a movimentação
    const [mov] = await dbRaw
      .select()
      .from(schema.creditoMovimentacao)
      .where(eq(schema.creditoMovimentacao.paymentId, payId))
      .limit(1);

    expect(mov).toBeDefined();
    expect(mov.clienteId).toBe(cli.id);
    expect(mov.valor).toBe("30.00");
    expect(mov.tipo).toBe("CONSUMIDO");

    // 6. Teste de Idempotência: rodar o webhook duplicado não pode consumir novamente
    const dDuplicado = dados(osId, "approved", payId);
    dDuplicado.metadata = {
      credito_utilizado: "30.00",
      cliente_id: cli.id,
    };
    await processarPagamento(dDuplicado, deps);

    const [cliLido2] = await dbRaw
      .select({ saldoCredito: schema.cliente.saldoCredito })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, cli.id))
      .limit(1);

    expect(cliLido2.saldoCredito).toBe("20.00"); // Permanece 20.00, não consome mais

    // Limpeza da movimentação
    await dbRaw.delete(schema.creditoMovimentacao).where(eq(schema.creditoMovimentacao.clienteId, cli.id));
  });
});
