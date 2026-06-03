import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { processarLembretesPagamento } from "@/notificacao/lembrete-pagamento";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955501";

// messageId único por chamada e por instância — o job varre TODAS as OS
// CONCLUÍDA globalmente (correto em produção), então pode enviar também para OS
// semeadas por outros testes; um wamid aleatório evita colisão na coluna UNIQUE.
function fakeGateway(): GatewayWhatsApp & {
  chamadas: { destinatario: string; template: string; variaveis: Record<string, string> }[];
} {
  const id = Math.random().toString(36).slice(2, 10);
  const chamadas: {
    destinatario: string;
    template: string;
    variaveis: Record<string, string>;
  }[] = [];
  return {
    chamadas,
    async enviarTemplate(req) {
      chamadas.push(req);
      return { messageId: `wamid.LEMB-${id}-${chamadas.length}` };
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

  /** Marcos de lembrete persistidos para uma OS específica. */
  async function marcosDaOs(osId: string) {
    const linhas = await db
      .select()
      .from(schema.notificacaoMarco)
      .where(like(schema.notificacaoMarco.marco, "lembrete_pagamento:%"));
    return linhas.filter((m) => m.osId === osId).map((m) => m.marco);
  }

  // O job varre TODAS as OS CONCLUÍDA do banco — em suíte paralela ele pode
  // tocar OS de outros testes. Por isso as asserções olham só os dados desta OS
  // (destinatário + marco), nunca a contagem global de enviados.

  it("dispara lembrete dia1 para OS CONCLUIDA há ≥24h sem PAGA (WhatsApp + e-mail)", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { os, cli } = await seedConcluida({ whatsapp: destinatario, horasAtras: 25 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    const minhas = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].template).toBe("lembrete_pagamento");
    expect(minhas[0].variaveis.valor).toContain("280");
    // Ordem posicional dos params casa com o catálogo (layout do template Meta).
    expect(Object.keys(minhas[0].variaveis)).toEqual([
      "saudacao",
      "nome_cliente",
      "valor",
      "link",
      "assinatura",
    ]);
    expect(email.chamadas.filter((c) => c.para === cli.email)).toHaveLength(1);
    expect(await marcosDaOs(os.id)).toEqual(["lembrete_pagamento:dia1"]);
  });

  it("lembrete dia1 envia só 1 vez mesmo rodando o job várias vezes (dedup por marco)", async () => {
    const destinatario = `${PREFIXO_WPP}02`;
    const { os, cli } = await seedConcluida({ whatsapp: destinatario, horasAtras: 30 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });
    await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    // Apesar de duas execuções, o marco garante um único envio por canal.
    expect(gateway.chamadas.filter((c) => c.destinatario === destinatario)).toHaveLength(1);
    expect(email.chamadas.filter((c) => c.para === cli.email)).toHaveLength(1);
    expect(await marcosDaOs(os.id)).toEqual(["lembrete_pagamento:dia1"]);
  });

  it("não dispara para OS já PAGA nem para tipo PREVENTIVA (sem pagamento)", async () => {
    const wppPaga = `${PREFIXO_WPP}03`;
    const wppPrev = `${PREFIXO_WPP}04`;
    const paga = await seedConcluida({ whatsapp: wppPaga, horasAtras: 50, estado: "PAGA" });
    const prev = await seedConcluida({ whatsapp: wppPrev, horasAtras: 50, tipo: "PREVENTIVA" });
    const gateway = fakeGateway();
    const email = fakeEmail();

    await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(gateway.chamadas.filter((c) => c.destinatario === wppPaga || c.destinatario === wppPrev)).toHaveLength(0);
    expect(await marcosDaOs(paga.os.id)).toEqual([]);
    expect(await marcosDaOs(prev.os.id)).toEqual([]);
  });

  it("OS concluída há <24h ainda não recebe lembrete", async () => {
    const destinatario = `${PREFIXO_WPP}05`;
    const { os } = await seedConcluida({ whatsapp: destinatario, horasAtras: 10 });
    const gateway = fakeGateway();
    const email = fakeEmail();

    await processarLembretesPagamento({ gateway, agora: AGORA, enviarEmail: email.enviar });

    expect(gateway.chamadas.filter((c) => c.destinatario === destinatario)).toHaveLength(0);
    expect(await marcosDaOs(os.id)).toEqual([]);
  });
});
