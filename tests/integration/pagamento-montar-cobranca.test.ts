import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import {
  montarCobrancaCampo,
  montarCobrancaConsolidada,
} from "@/pagamento/montar-cobranca";
import type { GatewayPagamento } from "@/pagamento/gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

function fakeGateway(): GatewayPagamento & {
  pix: { transaction_amount: number; metadata?: Record<string, unknown> }[];
  prefs: {
    items: { titulo: string; quantidade: number; precoUnitario: string }[];
    metadata?: Record<string, unknown>;
  }[];
} {
  const pix: { transaction_amount: number; metadata?: Record<string, unknown> }[] = [];
  const prefs: {
    items: { titulo: string; quantidade: number; precoUnitario: string }[];
    metadata?: Record<string, unknown>;
  }[] = [];
  return {
    pix,
    prefs,
    async criarPreferencia(req) {
      prefs.push({
        items: (req.items ?? []).map(
          (i: { title: string; quantity: number; unit_price: number }) => ({
            titulo: i.title,
            quantidade: i.quantity,
            precoUnitario: i.unit_price.toFixed(2),
          }),
        ),
        metadata: req.metadata as Record<string, unknown>,
      });
      return { id: `pref-${prefs.length}`, init_point: `https://mp.test/${prefs.length}` };
    },
    async criarPagamentoPix(req) {
      pix.push({ transaction_amount: req.transaction_amount, metadata: req.metadata });
      return {
        id: `pix-${pix.length}`,
        point_of_interaction: {
          transaction_data: { qr_code_base64: "QR64", qr_code: "copia-cola" },
        },
      };
    },
    async buscarPagamento() {
      throw new Error("não usado");
    },
  };
}

describe.skipIf(!hasDb)("montar cobrança no domínio (#167)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const orcIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    if (orcIds.length) {
      await db.delete(schema.orcamento).where(inArray(schema.orcamento.id, orcIds));
      orcIds.length = 0;
    }
    if (osIds.length) {
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seed(opts: {
    estado?: string;
    total?: string;
    aprovado?: boolean;
    saldoCredito?: string;
    descontoPlano?: string;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli Cob ${r}`,
        whatsapp: `55116${r.replace(/\D/g, "3").slice(0, 8)}`,
        email: `cob-${r}@dbg.test`,
        endereco: { logradouro: "Rua C", cidade: "São Paulo", uf: "SP" },
        saldoCredito: opts.saldoCredito ?? "0.00",
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-cob-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste montar cobranca",
        endereco: { logradouro: "Rua C", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: (opts.estado ?? "CONCLUIDA") as never,
      })
      .returning();
    osIds.push(os.id);

    const [orc] = await db
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `apr-cob-${r}`,
        totalMaoDeObra: opts.total ?? "300.00",
        totalDeslocamento: "0.00",
        descontoPlano: opts.descontoPlano ?? "0",
        total: opts.total ?? "300.00",
        validoAte: new Date(Date.now() + 7 * 24 * 3_600_000),
        aprovadoEm: opts.aprovado === false ? null : new Date(),
      })
      .returning();
    orcIds.push(orc.id);

    return { cli, sol, os, orc };
  }

  it("campo/pix: OS cobrável com orçamento aprovado gera Pix QR com o total", async () => {
    const { os } = await seed({ total: "350.00" });
    const gateway = fakeGateway();

    const res = await montarCobrancaCampo(os.id, "pix", { gateway });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pix?.qrBase64).toBe("QR64");
      expect(res.pix?.copiaCola).toBe("copia-cola");
    }
    expect(gateway.pix).toHaveLength(1);
    expect(gateway.pix[0].transaction_amount).toBe(350);
  });

  it("campo: estado não cobrável e orçamento não aprovado falham sem chamar o gateway", async () => {
    const emExecucao = await seed({ estado: "EM_EXECUCAO" });
    const semAprovacao = await seed({ aprovado: false });
    const gateway = fakeGateway();

    const r1 = await montarCobrancaCampo(emExecucao.os.id, "pix", { gateway });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.erro).toContain("CONCLUIDA");

    const r2 = await montarCobrancaCampo(semAprovacao.os.id, "link", { gateway });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro).toContain("orçamento aprovado");

    expect(gateway.pix).toHaveLength(0);
    expect(gateway.prefs).toHaveLength(0);
  });

  it("campo/link: gera preferência e devolve url + categoria para a UI", async () => {
    const { os } = await seed({ total: "200.00" });
    const gateway = fakeGateway();

    const res = await montarCobrancaCampo(os.id, "link", { gateway });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.link?.url).toContain("https://mp.test/");
      expect(res.link?.categoria).toBe("ELETRICA");
    }
    expect(gateway.prefs[0].items[0].precoUnitario).toBe("200.00");
  });

  it("consolidado/os: deduz o crédito de indicação e registra no metadata", async () => {
    const { sol, os } = await seed({ total: "300.00", saldoCredito: "50.00" });
    const gateway = fakeGateway();

    const res = await montarCobrancaConsolidada(
      sol.token,
      { tipo: "os", osId: os.id },
      { gateway },
    );

    expect("url" in res && res.url).toBeTruthy();
    expect(gateway.prefs[0].items[0].precoUnitario).toBe("250.00");
    expect(gateway.prefs[0].metadata?.credito_utilizado).toBe("50.00");
    expect(gateway.prefs[0].metadata?.cliente_id).toBeDefined();
  });

  it("consolidado/os: crédito maior que o total cobra o piso de 0.01", async () => {
    const { sol, os } = await seed({ total: "30.00", saldoCredito: "100.00" });
    const gateway = fakeGateway();

    await montarCobrancaConsolidada(sol.token, { tipo: "os", osId: os.id }, { gateway });

    expect(gateway.prefs[0].items[0].precoUnitario).toBe("0.01");
    expect(gateway.prefs[0].metadata?.credito_utilizado).toBe("29.99");
  });

  it("consolidado/tudo: soma só as OS pagáveis", async () => {
    const { sol, os } = await seed({ total: "100.00" });
    // Segunda OS na mesma solicitação, já PAGA — fora da soma.
    const [osPaga] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "PINTURA",
        tipo: "NORMAL",
        estado: "PAGA",
      })
      .returning();
    osIds.push(osPaga.id);

    const gateway = fakeGateway();
    const res = await montarCobrancaConsolidada(sol.token, { tipo: "tudo" }, { gateway });

    expect("url" in res && res.url).toBeTruthy();
    expect(gateway.prefs[0].items[0].precoUnitario).toBe("100.00");
    expect(gateway.prefs[0].metadata?.os_ids).toEqual([os.id]);
  });

  it("desconto de assinante embutido no orçamento aprovado é o valor cobrado", async () => {
    // Orçamento criado com desconto de plano: total líquido 270.00.
    const { os } = await seed({ total: "270.00", descontoPlano: "30.00" });
    const gateway = fakeGateway();

    await montarCobrancaCampo(os.id, "pix", { gateway });

    expect(gateway.pix[0].transaction_amount).toBe(270);
  });

  it("token inexistente → erro sem lançar", async () => {
    const gateway = fakeGateway();
    const res = await montarCobrancaConsolidada(
      "tok-cob-inexistente",
      { tipo: "tudo" },
      { gateway },
    );
    expect("erro" in res && res.erro).toBeTruthy();
  });
});
