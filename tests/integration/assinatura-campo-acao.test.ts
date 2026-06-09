import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { inArray } from "drizzle-orm";

vi.mock("@/app/campo/guard", () => ({
  exigirTecnico: () => Promise.resolve(),
}));

import { enviarAssinaturaAction } from "@/app/campo/os/[id]/assinatura/actions";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("enviarAssinaturaAction (PWA pós-conclusão #65)", () => {
  const clienteIds: string[] = [];
  const solicitacaoIds: string[] = [];
  const planoIds: string[] = [];

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
  });

  afterAll(async () => {
    if (clienteIds.length) {
      await db
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.clienteId, clienteIds));
    }
    if (solicitacaoIds.length) {
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await db
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (planoIds.length) {
      await db.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    }
    if (clienteIds.length) {
      await db
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seed(estado: "CONCLUIDA" | "PAGA" | "EM_EXECUCAO") {
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
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua Y", cidade: "Niterói", uf: "RJ" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado,
      })
      .returning();
    const [pln] = await db
      .insert(schema.plano)
      .values({
        nome: "Conforto",
        slug: `conforto-${r}`,
        preco: "179.00",
        ativo: true,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    planoIds.push(pln.id);
    return { osId: os.id, slug: `conforto-${r}`, clienteId: cli.id, planoId: pln.id };
  }

  it("gera QR/link para OS PAGA (upsell pós-conclusão)", async () => {
    const { osId, slug } = await seed("PAGA");

    const res = await enviarAssinaturaAction(osId, slug);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.urlLanding).toContain(`/assinar/${slug}?os=${osId}`);
      expect(res.qrDataUrl).toMatch(/^data:image/);
    }
  });

  it("continua aceitando OS CONCLUIDA", async () => {
    const { osId, slug } = await seed("CONCLUIDA");
    const res = await enviarAssinaturaAction(osId, slug);
    expect(res.ok).toBe(true);
  });

  it("rejeita OS que não foi entregue (EM_EXECUCAO)", async () => {
    const { osId, slug } = await seed("EM_EXECUCAO");
    const res = await enviarAssinaturaAction(osId, slug);
    expect(res).toEqual({
      ok: false,
      erro: "A assinatura só pode ser oferecida em OS concluída ou paga.",
    });
  });

  it("recusa quando o cliente da OS já é assinante ativo", async () => {
    const { osId, slug, clienteId, planoId } = await seed("PAGA");
    await db.insert(schema.assinatura).values({
      clienteId,
      planoId,
      status: "ATIVA",
    });

    const res = await enviarAssinaturaAction(osId, slug);

    expect(res).toEqual({
      ok: false,
      erro: "Este cliente já é assinante de um plano DBG.",
    });
  });
});
