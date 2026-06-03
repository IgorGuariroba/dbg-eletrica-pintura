import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { processarLembretesPagamento } from "@/notificacao/lembrete-pagamento";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955501";

function fakeGateway(): GatewayWhatsApp & {
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
      return { messageId: `wamid.LEMB-${chamadas.length}` };
    },
  };
}

function fakeEmail(): {
  chamadas: { para: string; valor: string }[];
  enviar: (input: { para: string; clienteNome: string; numeroOS: string; valor: string; link: string }) => Promise<{ id: string }>;
} {
  const chamadas: { para: string; valor: string }[] = [];
  return {
    chamadas,
    async enviar(input) {
      chamadas.push({ para: input.para, valor: input.valor });
      return { id: `email-${chamadas.length}` };
    },
  };
}

const AGORA = new Date("2026-06-10T13:00:00Z"); // 10h BRT, dentro do horário

describe.skipIf(!hasDb)("Lembrete de Pagamento (Slice 2 — #46)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(schema.notificacaoWhatsapp)
      .where(like(schema.notificacaoWhatsapp.destinatario, `${PREFIXO_WPP}%`));
    await db
      .delete(schema.filaWhatsapp)
      .where(like(schema.filaWhatsapp.destinatario, `${PREFIXO_WPP}%`));
    if (osIds.length) {
      await db.delete(schema.orcamento).where(inArray(schema.orcamento.osId, osIds));
      await db.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      await db.delete(schema.notificacaoMarco).where(inArray(schema.notificacaoMarco.osId, osIds));
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

  /** Cria uma OS CONCLUIDA com a transição registrada `horasAtras` no passado. */
  async function seedConcluida(opts: {
    whatsapp: string;
    horasAtras: number;
    tipo?: "NORMAL" | "PREVENTIVA";
    estado?: "CONCLUIDA" | "PAGA";
    total?: string;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp: opts.whatsapp,
        email: `cli-${r}@dbg.test`,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-lemb-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste lembrete",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: opts.tipo ?? "NORMAL",
        estado: opts.estado ?? "CONCLUIDA",
      })
      .returning();
    osIds.push(os.id);

    await db.insert(schema.orcamento).values({
      osId: os.id,
      tokenAprovacao: `apr-${r}`,
      total: opts.total ?? "280.00",
      validoAte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await db.insert(schema.transicaoOs).values({
      osId: os.id,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "tec@dbg.test",
      em: new Date(AGORA.getTime() - opts.horasAtras * 60 * 60 * 1000),
    });

    return { os, sol, cli };
  }

  it("dispara lembrete dia1 para OS CONCLUIDA há ≥24h sem PAGA (WhatsApp + e-mail)", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { os } = await seedConcluida({ whatsapp: destinatario, horasAtras: 25 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(res.enviados).toBe(1);
    expect(gateway.chamadas).toHaveLength(1);
    expect(gateway.chamadas[0].template).toBe("lembrete_pagamento");
    expect(gateway.chamadas[0].destinatario).toBe(destinatario);
    expect(gateway.chamadas[0].variaveis.valor).toContain("280");
    expect(email.chamadas).toHaveLength(1);

    const marcos = await db
      .select()
      .from(schema.notificacaoMarco)
      .where(like(schema.notificacaoMarco.marco, "lembrete_pagamento:%"));
    const meu = marcos.filter((m) => m.osId === os.id);
    expect(meu).toHaveLength(1);
    expect(meu[0].marco).toBe("lembrete_pagamento:dia1");
  });

  it("lembrete dia1 envia só 1 vez mesmo rodando o job várias vezes (dedup por marco)", async () => {
    const destinatario = `${PREFIXO_WPP}02`;
    await seedConcluida({ whatsapp: destinatario, horasAtras: 30 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const r1 = await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });
    const r2 = await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(r1.enviados).toBe(1);
    expect(r2.enviados).toBe(0);
    expect(gateway.chamadas).toHaveLength(1);
    expect(email.chamadas).toHaveLength(1);
  });

  it("não dispara para OS já PAGA nem para tipo PREVENTIVA (sem pagamento)", async () => {
    await seedConcluida({ whatsapp: `${PREFIXO_WPP}03`, horasAtras: 50, estado: "PAGA" });
    await seedConcluida({ whatsapp: `${PREFIXO_WPP}04`, horasAtras: 50, tipo: "PREVENTIVA" });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(res.enviados).toBe(0);
    expect(gateway.chamadas).toHaveLength(0);
  });

  it("OS concluída há <24h ainda não recebe lembrete", async () => {
    await seedConcluida({ whatsapp: `${PREFIXO_WPP}05`, horasAtras: 10 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(res.enviados).toBe(0);
  });
});
