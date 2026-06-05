import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { resolverTratativa } from "@/marketing/resolver-tratativa";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Resolver Tratativa → Reavaliação Idempotente (Bloco RES)", () => {
  let db: typeof dbClient;
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];
  const alertaIds: string[] = [];

  beforeAll(() => {
    db = dbClient;
  });

  afterEach(async () => {
    if (alertaIds.length) {
      await db.delete(schema.notificacaoMarco).where(
        inArray(schema.notificacaoMarco.osId, osIds),
      );
      await db.delete(schema.tratativa).where(inArray(schema.tratativa.alertaAvaliacaoId, alertaIds));
      await db.delete(schema.alertaAvaliacao).where(inArray(schema.alertaAvaliacao.id, alertaIds));
      alertaIds.length = 0;
    }
    if (osIds.length) {
      await db.delete(schema.avaliacao).where(inArray(schema.avaliacao.osId, osIds));
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (tecIds.length) {
      await db.delete(schema.membro).where(inArray(schema.membro.id, tecIds));
      tecIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedContexto(token: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db.insert(schema.cliente).values({
      nome: `Cliente ${r}`,
      whatsapp: `55119${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `cli-${r}@dbg.test`,
      endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
    }).returning();
    cliIds.push(cli.id);

    const [sol] = await db.insert(schema.solicitacao).values({
      token,
      clienteId: cli.id,
      categorias: ["ELETRICA"],
      descricao: "teste resolver",
      endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
    }).returning();
    solIds.push(sol.id);

    const [tec] = await db.insert(schema.membro).values({
      nome: `Tecnico ${r}`,
      email: `tec-${r}@dbg.test`,
      isTecnico: true,
    }).returning();
    tecIds.push(tec.id);

    const [os] = await db.insert(schema.ordemServico).values({
      solicitacaoId: sol.id,
      categoria: "ELETRICA",
      tipo: "NORMAL",
      estado: "CONCLUIDA",
      tecnicoId: tec.id,
    }).returning();
    osIds.push(os.id);

    const [alerta] = await db.insert(schema.alertaAvaliacao).values({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId: tec.id,
      nota: 2,
      status: "PENDENTE",
    }).returning();
    alertaIds.push(alerta.id);

    return { os, sol, tec, alerta, token };
  }

  it("RES1 — tracer: resolver marca alerta RESOLVIDO e dispara reavaliação 1x", async () => {
    const token = `tok-res1-${Math.random().toString(36).slice(2, 10)}`;
    const { alerta, os } = await seedContexto(token);

    const enviarReavaliacao = vi.fn().mockResolvedValue(undefined);

    await resolverTratativa(alerta.id, { db, enviarReavaliacao });

    // Alerta marcado como RESOLVIDO
    const [alertaSalvo] = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.id, alerta.id));

    expect(alertaSalvo.status).toBe("RESOLVIDO");
    expect(alertaSalvo.resolvidoEm).toBeDefined();

    // Reavaliação enviada 1x
    expect(enviarReavaliacao).toHaveBeenCalledTimes(1);
    expect(enviarReavaliacao).toHaveBeenCalledWith(os.id);
  });

  it("RES2: reexecutar resolverTratativa não reenvia reavaliação (idempotente por status)", async () => {
    const token = `tok-res2-${Math.random().toString(36).slice(2, 10)}`;
    const { alerta } = await seedContexto(token);

    const enviarReavaliacao = vi.fn().mockResolvedValue(undefined);

    // Primeira execução
    await resolverTratativa(alerta.id, { db, enviarReavaliacao });
    // Segunda execução (alerta já RESOLVIDO)
    await resolverTratativa(alerta.id, { db, enviarReavaliacao });

    // enviarReavaliacao chamada apenas 1x
    expect(enviarReavaliacao).toHaveBeenCalledTimes(1);
  });

  it("RES3: alerta reaberto (PENDENTE) por reavaliação negativa volta a disparar", async () => {
    const token = `tok-res3-${Math.random().toString(36).slice(2, 10)}`;
    const { alerta } = await seedContexto(token);

    const enviarReavaliacao = vi.fn().mockResolvedValue(undefined);

    // 1ª rodada de tratativa
    await resolverTratativa(alerta.id, { db, enviarReavaliacao });

    // Cliente reavalia mal de novo → fluxo de avaliação reabre o alerta
    await db
      .update(schema.alertaAvaliacao)
      .set({ status: "PENDENTE" })
      .where(eq(schema.alertaAvaliacao.id, alerta.id));

    // 2ª rodada de tratativa dispara um novo convite
    await resolverTratativa(alerta.id, { db, enviarReavaliacao });

    expect(enviarReavaliacao).toHaveBeenCalledTimes(2);
  });

  it("RES4: falha no envio reverte status para PENDENTE e permite nova tentativa", async () => {
    const token = `tok-res4-${Math.random().toString(36).slice(2, 10)}`;
    const { alerta } = await seedContexto(token);

    const enviarFalho = vi.fn().mockRejectedValueOnce(new Error("WhatsApp down"));

    await expect(
      resolverTratativa(alerta.id, { db, enviarReavaliacao: enviarFalho }),
    ).rejects.toThrow("WhatsApp down");

    // Status revertido para PENDENTE (não ficou resolvido sem notificar)
    const [revertido] = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.id, alerta.id));
    expect(revertido.status).toBe("PENDENTE");
    expect(revertido.resolvidoEm).toBeNull();

    // Retry com envio funcionando resolve e dispara
    const enviarOk = vi.fn().mockResolvedValue(undefined);
    await resolverTratativa(alerta.id, { db, enviarReavaliacao: enviarOk });
    expect(enviarOk).toHaveBeenCalledTimes(1);

    const [resolvido] = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.id, alerta.id));
    expect(resolvido.status).toBe("RESOLVIDO");
  });
});
