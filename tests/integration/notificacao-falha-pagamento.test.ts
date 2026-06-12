import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray, like } from "drizzle-orm";
import { notificar } from "@/notificacao/notificar";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955504";
// Dentro da janela 8h–20h (São Paulo) — fora dela o WhatsApp vai pra fila.
const AGORA = new Date("2026-06-12T15:00:00-03:00");
const FORA_DA_JANELA = new Date("2026-06-12T22:30:00-03:00");

function fakeWhatsapp(): GatewayWhatsApp & {
  chamadas: { destinatario: string; template: string; variaveis: Record<string, string> }[];
} {
  const chamadas: {
    destinatario: string;
    template: string;
    variaveis: Record<string, string>;
  }[] = [];
  return {
    chamadas,
    async enviarTemplate(req) {
      chamadas.push(req);
      return { messageId: `wamid.FALHA-${chamadas.length}` };
    },
  };
}

function fakeEmail(): EmailService & { enviados: EnviarEmailInput[] } {
  const enviados: EnviarEmailInput[] = [];
  return {
    enviados,
    async enviar(input) {
      enviados.push(input);
      return { id: `mock-falha-${enviados.length}` };
    },
  };
}

describe.skipIf(!hasDb)("notificar(assinatura.pagamento_falhou) (#161)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const assIds: string[] = [];
  const cliIds: string[] = [];
  const planoIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    await db
      .delete(schema.notificacaoWhatsapp)
      .where(like(schema.notificacaoWhatsapp.destinatario, `${PREFIXO_WPP}%`));
    await db
      .delete(schema.filaWhatsapp)
      .where(like(schema.filaWhatsapp.destinatario, `${PREFIXO_WPP}%`));
    if (assIds.length) {
      await db
        .delete(schema.notificacaoMarco)
        .where(inArray(schema.notificacaoMarco.refId, assIds));
      await db.delete(schema.assinatura).where(inArray(schema.assinatura.id, assIds));
      assIds.length = 0;
    }
    if (planoIds.length) {
      await db.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
      planoIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedAssinatura(opts: { whatsapp?: string; email: string | null }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli Falha ${r}`,
        whatsapp: opts.whatsapp ?? `55118${r.replace(/\D/g, "1").slice(0, 8)}`,
        email: opts.email,
        endereco: { logradouro: "Rua T", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [pl] = await db
      .insert(schema.plano)
      .values({ nome: `Plano F ${r}`, preco: "79.90" })
      .returning();
    planoIds.push(pl.id);

    const pre = `pre-falha-${r}`;
    const [ass] = await db
      .insert(schema.assinatura)
      .values({
        clienteId: cli.id,
        planoId: pl.id,
        preapprovalIdMp: pre,
        status: "ATIVA",
      })
      .returning();
    assIds.push(ass.id);

    return { cli, pl, ass, pre };
  }

  it("dispara WhatsApp + e-mail com link de atualização do MP", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { pre } = await seedAssinatura({
      whatsapp: destinatario,
      email: "falha@dbg.test",
    });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-1" },
      { whatsapp, email, agora: AGORA },
    );

    expect(resultado.whatsapp?.status).toBe("enviado");
    expect(resultado.email?.status).toBe("sent");

    const minhas = whatsapp.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].template).toBe("assinatura_pagamento_falhou");
    expect(minhas[0].variaveis.link).toContain(pre);

    expect(email.enviados).toHaveLength(1);
    expect(email.enviados[0].assunto).toContain("Falha no pagamento");
    expect(email.enviados[0].html).toContain(pre);
  });

  it("fora do Horário Restrito: WhatsApp vai pra fila, e-mail sai", async () => {
    const destinatario = `${PREFIXO_WPP}02`;
    const { pre } = await seedAssinatura({
      whatsapp: destinatario,
      email: "falha-fila@dbg.test",
    });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-2" },
      { whatsapp, email, agora: FORA_DA_JANELA },
    );

    expect(resultado.whatsapp?.status).toBe("enfileirado");
    expect(whatsapp.chamadas).toHaveLength(0);
    expect(email.enviados).toHaveLength(1);
  });

  it("cliente sem e-mail → pula o canal e-mail sem lançar", async () => {
    const destinatario = `${PREFIXO_WPP}03`;
    const { pre } = await seedAssinatura({ whatsapp: destinatario, email: null });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-3" },
      { whatsapp, email, agora: AGORA },
    );

    expect(resultado.whatsapp?.status).toBe("enviado");
    expect(resultado.email?.status).toBe("skipped");
    expect(email.enviados).toHaveLength(0);
  });

  it("marco por evento: mesmo eventId não reenvia; falha nova (eventId novo) envia", async () => {
    const destinatario = `${PREFIXO_WPP}04`;
    const { pre } = await seedAssinatura({
      whatsapp: destinatario,
      email: "falha-marco@dbg.test",
    });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();
    const deps = { whatsapp, email, agora: AGORA };

    await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-4" },
      deps,
    );
    // Reexecução do mesmo webhook (mesmo eventId) → no-op.
    await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-4" },
      deps,
    );
    expect(email.enviados).toHaveLength(1);
    expect(whatsapp.chamadas).toHaveLength(1);

    // Falha nova (outro ciclo, outro eventId) → notifica de novo.
    await notificar(
      { tipo: "assinatura.pagamento_falhou", preapprovalIdMp: pre, eventId: "ev-5" },
      deps,
    );
    expect(email.enviados).toHaveLength(2);
    expect(whatsapp.chamadas).toHaveLength(2);
  });

  it("preapproval inexistente → skip sem lançar", async () => {
    const resultado = await notificar(
      {
        tipo: "assinatura.pagamento_falhou",
        preapprovalIdMp: "pre-falha-inexistente",
        eventId: "ev-6",
      },
      { whatsapp: fakeWhatsapp(), email: fakeEmail(), agora: AGORA },
    );
    expect(resultado.whatsapp?.status).toBe("skipped");
    expect(resultado.email?.status).toBe("skipped");
  });
});
