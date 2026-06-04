import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db as dbRaw } from "@/db/client";
import * as schema from "@/db/schema";
import { aplicarGarantiaAction, rejeitarGarantiaAction } from "@/app/admin/garantias/actions";
import { eq, inArray, and } from "drizzle-orm";
import * as guardMock from "@/app/admin/garantias/guard";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

vi.mock("@/app/admin/garantias/guard", () => ({
  exigirGarantias: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe.skipIf(!hasDb)("Garantia Decisao Actions Integration", () => {
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let osIds: string[] = [];
  let pagamentoIds: { paymentId: string; osId: string }[] = [];
  let chamadosCriados: string[] = [];

  async function seedClienteESolicitacao() {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        origem: "FORMULARIO",
        lgpdAceito: true,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { cli, sol, r };
  }

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    osIds = [];
    pagamentoIds = [];
    chamadosCriados = [];
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (chamadosCriados.length) {
      await dbRaw.delete(schema.garantiaChamado).where(inArray(schema.garantiaChamado.id, chamadosCriados));
    }
    if (pagamentoIds.length) {
      for (const p of pagamentoIds) {
        await dbRaw
          .delete(schema.pagamento)
          .where(and(eq(schema.pagamento.paymentId, p.paymentId), eq(schema.pagamento.osId, p.osId)));
      }
    }
    if (osIds.length) {
      await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      
      const childOs = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.osPaiId, osIds));
      const childOsIds = childOs.map((o) => o.id);
      if (childOsIds.length) {
        await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, childOsIds));
        await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, childOsIds));
      }
      await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
    }
    if (solicitacaoIds.length) {
      await dbRaw.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("bloqueia chamadas se o membro não tiver o módulo Garantias (guard lança erro)", async () => {
    vi.mocked(guardMock.exigirGarantias).mockRejectedValue(new Error("Acesso negado"));

    await expect(aplicarGarantiaAction("chamado-qualquer", null)).rejects.toThrow("Acesso negado");
    await expect(rejeitarGarantiaAction("chamado-qualquer", "Motivo de teste")).rejects.toThrow("Acesso negado");
  });

  it("sucesso ao aplicar garantia e criar OS Garantia", async () => {
    vi.mocked(guardMock.exigirGarantias).mockResolvedValue({ email: "membro@dbg.test" } as any);

    const { sol, r } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "120.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: new Date(),
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    const [chamado] = await dbRaw
      .insert(schema.garantiaChamado)
      .values({
        osOrigemId: os.id,
        descricao: "Descrição com mais de 20 caracteres para testar a action",
        fotoUrl: "http://r2/foto.jpg",
        criadoPor: "cliente@dbg.com",
        canal: "PORTAL",
        status: "pendente",
      })
      .returning();
    chamadosCriados.push(chamado.id);

    const res = await aplicarGarantiaAction(chamado.id, null);
    expect(res.erro).toBeUndefined();
    expect(res.osGarantiaId).toBeDefined();

    // Verifica que OS de origem mudou para GARANTIA_ABERTA
    const [origem] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os.id))
      .limit(1);
    expect(origem.estado).toBe("GARANTIA_ABERTA");
  });

  it("sucesso ao rejeitar garantia", async () => {
    vi.mocked(guardMock.exigirGarantias).mockResolvedValue({ email: "membro@dbg.test" } as any);

    const { sol, r } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "120.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: new Date(),
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    const [chamado] = await dbRaw
      .insert(schema.garantiaChamado)
      .values({
        osOrigemId: os.id,
        descricao: "Descrição com mais de 20 caracteres para testar a action de rejeição",
        fotoUrl: "http://r2/foto.jpg",
        criadoPor: "cliente@dbg.com",
        canal: "PORTAL",
        status: "pendente",
      })
      .returning();
    chamadosCriados.push(chamado.id);

    const res = await rejeitarGarantiaAction(chamado.id, "Problema recorrente sem culpa da mão de obra");
    expect(res.erro).toBeUndefined();
    expect(res.ok).toBe(true);

    const [chamadoFinal] = await dbRaw
      .select({ status: schema.garantiaChamado.status })
      .from(schema.garantiaChamado)
      .where(eq(schema.garantiaChamado.id, chamado.id))
      .limit(1);
    expect(chamadoFinal.status).toBe("rejeitada");
  });
});
