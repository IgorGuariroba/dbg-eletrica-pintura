import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray, like } from "drizzle-orm";
import { notificar } from "@/notificacao/notificar";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

function fakeEmail(): EmailService & { enviados: EnviarEmailInput[] } {
  const enviados: EnviarEmailInput[] = [];
  return {
    enviados,
    async enviar(input) {
      enviados.push(input);
      return { id: `mock-bv-${enviados.length}` };
    },
  };
}

describe.skipIf(!hasDb)("notificar(assinatura.criada*) — boas-vindas (#160)", () => {
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

  async function seedAssinatura(opts: {
    email: string | null;
    preapproval?: string;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli BV ${r}`,
        whatsapp: `55119444${r.slice(0, 5)}`,
        email: opts.email,
        endereco: { logradouro: "Rua T", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [pl] = await db
      .insert(schema.plano)
      .values({
        nome: `Plano BV ${r}`,
        preco: "99.90",
        beneficios: "2 visitas preventivas\n10% de desconto\nPrioridade no agendamento",
      })
      .returning();
    planoIds.push(pl.id);

    const [ass] = await db
      .insert(schema.assinatura)
      .values({
        clienteId: cli.id,
        planoId: pl.id,
        preapprovalIdMp: opts.preapproval ?? null,
        status: "PENDENTE",
      })
      .returning();
    assIds.push(ass.id);

    return { cli, pl, ass };
  }

  it("assinatura.criada envia boas-vindas com plano, benefícios e próxima cobrança", async () => {
    const pre = `pre-bv-${Math.random().toString(36).slice(2, 8)}`;
    const { pl } = await seedAssinatura({ email: "bv@dbg.test", preapproval: pre });
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.criada", preapprovalIdMp: pre },
      {
        email,
        mpAssinatura: {
          buscarAssinatura: async () => ({
            id: pre,
            status: "authorized",
            nextPaymentDate: "2026-07-12T10:00:00.000Z",
          }),
        },
      },
    );

    expect(resultado.email?.status).toBe("sent");
    expect(email.enviados).toHaveLength(1);
    expect(email.enviados[0].assunto).toContain(pl.nome);
    expect(email.enviados[0].html).toContain("2 visitas preventivas");
    expect(email.enviados[0].html).toContain("12/07/2026");
  });

  it("assinatura.criada_combo envia com próxima cobrança 'a confirmar'", async () => {
    const { ass, pl } = await seedAssinatura({ email: "bv-combo@dbg.test" });
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.criada_combo", assinaturaId: ass.id },
      { email },
    );

    expect(resultado.email?.status).toBe("sent");
    expect(email.enviados[0].assunto).toContain(pl.nome);
    expect(email.enviados[0].html).toContain("a confirmar");
  });

  it("cliente sem e-mail → skip logado, sem lançar", async () => {
    const { ass } = await seedAssinatura({ email: null });
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "assinatura.criada_combo", assinaturaId: ass.id },
      { email },
    );

    expect(resultado.email?.status).toBe("skipped");
    expect(email.enviados).toHaveLength(0);
  });

  it("marco (assinaturaId, boas_vindas): reexecução não reenvia", async () => {
    const pre = `pre-bv-${Math.random().toString(36).slice(2, 8)}`;
    await seedAssinatura({ email: "bv-marco@dbg.test", preapproval: pre });
    const email = fakeEmail();
    const deps = {
      email,
      mpAssinatura: {
        buscarAssinatura: async () => ({
          id: pre,
          status: "authorized",
          nextPaymentDate: undefined,
        }),
      },
    };

    await notificar({ tipo: "assinatura.criada", preapprovalIdMp: pre }, deps);
    await notificar({ tipo: "assinatura.criada", preapprovalIdMp: pre }, deps);

    expect(email.enviados).toHaveLength(1);
  });

  it("preapproval inexistente → skip sem lançar", async () => {
    const email = fakeEmail();
    const resultado = await notificar(
      { tipo: "assinatura.criada", preapprovalIdMp: "pre-bv-inexistente" },
      { email },
    );
    expect(resultado.email?.status).toBe("skipped");
  });
});
