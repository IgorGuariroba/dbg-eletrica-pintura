import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { criarPagamentoCheckoutRepoDrizzle } from "@/pagamento/checkout-query-repo-drizzle";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("PagamentoCheckoutRepoDrizzle", () => {
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  let repo: ReturnType<typeof criarPagamentoCheckoutRepoDrizzle>;

  beforeAll(() => {
    repo = criarPagamentoCheckoutRepoDrizzle(db);
  });

  beforeEach(() => {
    solicitacaoIds = [];
    clienteIds = [];
  });

  afterAll(async () => {
    if (solicitacaoIds.length) {
      const osRows = await db
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await db.delete(schema.pagamento).where(inArray(schema.pagamento.osId, osIds));
        await db.delete(schema.orcamentoItem).where(
          inArray(
            schema.orcamentoItem.orcamentoId,
            db
              .select({ id: schema.orcamento.id })
              .from(schema.orcamento)
              .where(inArray(schema.orcamento.osId, osIds))
          )
        );
        await db.delete(schema.orcamento).where(inArray(schema.orcamento.osId, osIds));
        await db.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      }
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await db
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seedSetup(token: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token,
        clienteId: cli.id,
        categorias: ["ELETRICA", "PINTURA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua Y", cidade: "Niterói", uf: "RJ" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();

    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { solId: sol.id };
  }

  async function seedOs(solId: string, categoria: "ELETRICA" | "PINTURA", estado: string, totalOrcamento?: string) {
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: solId,
        categoria,
        tipo: "NORMAL",
        // biome-ignore lint/suspicious/noExplicitAny: estado de teste
        estado: estado as any,
      })
      .returning();

    if (totalOrcamento) {
      // Cria orçamento aprovado
      await db.insert(schema.orcamento).values({
        osId: os.id,
        tokenAprovacao: `aprov-${os.id}`,
        total: totalOrcamento,
        validoAte: new Date(Date.now() + 86400 * 1000),
        aprovadoEm: new Date(),
      });
    }

    return os.id;
  }

  it("comportamento 5: carregarPorToken retorna apenas OSs CONCLUIDA/PAGA da solicitacao com orcamento aprovado", async () => {
    const token = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId } = await seedSetup(token);

    // OS 1: CONCLUIDA com orçamento de 250.00
    const osId1 = await seedOs(solId, "ELETRICA", "CONCLUIDA", "250.00");
    // OS 2: PAGA com orçamento de 120.00
    const osId2 = await seedOs(solId, "PINTURA", "PAGA", "120.00");
    // OS 3: ORCADA (deve ser ignorada pois não é CONCLUIDA nem PAGA)
    await seedOs(solId, "ELETRICA", "ORCADA", "300.00");

    // OS de outra solicitacao (deve ser ignorada)
    const token2 = `tok-${Math.random().toString(36).slice(2, 10)}`;
    const { solId: solId2 } = await seedSetup(token2);
    await seedOs(solId2, "ELETRICA", "CONCLUIDA", "500.00");

    const solView = await repo.carregarPorToken(token);

    expect(solView).not.toBeNull();
    expect(solView!.token).toBe(token);
    expect(solView!.clienteNome).toContain("Cli");
    expect(solView!.cidade).toBe("Niterói");
    expect(solView!.uf).toBe("RJ");

    // Deve conter apenas as duas OSs (OS 1 e OS 2)
    expect(solView!.ordens).toHaveLength(2);

    const o1 = solView!.ordens.find((o) => o.osId === osId1);
    expect(o1).toBeDefined();
    expect(o1!.categoria).toBe("ELETRICA");
    expect(o1!.estado).toBe("CONCLUIDA");
    expect(o1!.total).toBe("250.00");
    expect(o1!.pago).toBe(false);

    const o2 = solView!.ordens.find((o) => o.osId === osId2);
    expect(o2).toBeDefined();
    expect(o2!.categoria).toBe("PINTURA");
    expect(o2!.estado).toBe("PAGA");
    expect(o2!.total).toBe("120.00");
    expect(o2!.pago).toBe(true);
  });

  it("retorna null para token inexistente", async () => {
    const solView = await repo.carregarPorToken("token-inexistente");
    expect(solView).toBeNull();
  });
});
