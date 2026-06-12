import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db as dbRaw } from "@/db/client";
import * as schema from "@/db/schema";
import { registrarAcionamentoGarantiaAction } from "@/app/admin/garantias/actions";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

vi.mock("@/app/admin/garantias/guard", () => ({
  exigirGarantias: vi.fn().mockResolvedValue({ email: "admin@dbg.test" }),
}));

vi.mock("@/lib/storage", () => ({
  uploadFotoGarantia: vi.fn().mockResolvedValue("fotos/chamados/foto.jpg"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe.skipIf(!hasDb)("registrarAcionamentoGarantiaAction Server Action Integration", () => {
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let osIds: string[] = [];
  let pagamentoIds: { paymentId: string; osId: string }[] = [];
  let chamadosCriados: string[] = [];

  async function seedClienteESolicitacao(whatsapp: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp })
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
  });

  afterAll(async () => {
    const { inArray, and, eq } = await import("drizzle-orm");

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
      await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
    }
    if (solicitacaoIds.length) {
      await dbRaw.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("sucesso ao registrar acionamento quando o whatsapp coincide", async () => {
    const whatsappOriginal = String(Math.floor(1e12 + Math.random() * 9e12));
    const { sol, r } = await seedClienteESolicitacao(whatsappOriginal);
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "CONCLUIDA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    const dataPagamento = new Date();
    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "150.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: dataPagamento,
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    // Tenta registrar com WhatsApp idêntico
    const res = await registrarAcionamentoGarantiaAction(
      os.id,
      whatsappOriginal,
      "Relato de teste com mais de vinte caracteres para a garantia",
      "data:image/png;base64,abc"
    );

    expect(res.erro).toBeUndefined();
    expect(res.chamadoId).toBeDefined();
    if (res.chamadoId) {
      chamadosCriados.push(res.chamadoId);
    }
  });

  it("erro ao registrar acionamento quando o whatsapp não coincide", async () => {
    const whatsappOriginal = String(Math.floor(1e12 + Math.random() * 9e12));
    const { sol, r } = await seedClienteESolicitacao(whatsappOriginal);
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "CONCLUIDA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    const dataPagamento = new Date();
    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "150.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: dataPagamento,
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    // Tenta registrar com WhatsApp diferente
    const res = await registrarAcionamentoGarantiaAction(
      os.id,
      "5511988887777",
      "Relato de teste com mais de vinte caracteres para a garantia",
      "data:image/png;base64,abc"
    );

    expect(res.erro).toContain("não coincide");
    expect(res.chamadoId).toBeUndefined();
  });
});
