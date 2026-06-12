import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray, like } from "drizzle-orm";
import { notificar } from "@/notificacao/notificar";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const hasR2 = Boolean(
  process.env.R2_PRIVATE_ACCOUNT_ID &&
    process.env.R2_PRIVATE_ACCESS_KEY_ID &&
    process.env.R2_PRIVATE_SECRET_ACCESS_KEY &&
    process.env.R2_PRIVATE_BUCKET,
);
const PREFIXO_WPP = "5511955503";
// Relógio fixo dentro da janela 8h–20h (São Paulo); sem isso o WhatsApp é
// enfileirado fora do horário comercial e o gateway nunca é chamado.
const AGORA = new Date("2026-06-12T15:00:00-03:00");

function fakeWhatsapp(): GatewayWhatsApp & {
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
      return { messageId: `wamid.NOTIF-${id}-${chamadas.length}` };
    },
  };
}

function fakeEmail(): EmailService & { enviados: EnviarEmailInput[] } {
  const enviados: EnviarEmailInput[] = [];
  return {
    enviados,
    async enviar(input) {
      enviados.push(input);
      return { id: `mock-notificar-${enviados.length}` };
    },
  };
}

describe.skipIf(!hasDb || !hasR2)("notificar(evento) — interface única (#159)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];

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
    if (osIds.length) {
      await db
        .delete(schema.notificacaoMarco)
        .where(inArray(schema.notificacaoMarco.refId, osIds));
      await db
        .delete(schema.orcamento)
        .where(inArray(schema.orcamento.osId, osIds));
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.id, osIds));
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

  async function seedOs(opts: {
    whatsapp: string;
    estado: "ORCADA" | "PAGA";
    comOrcamento?: boolean;
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
        token: `tok-notif-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste interface notificar",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: opts.estado,
      })
      .returning();
    osIds.push(os.id);

    if (opts.comOrcamento) {
      await db.insert(schema.orcamento).values({
        osId: os.id,
        tokenAprovacao: `tok-aprov-${r}`,
        totalMaoDeObra: "100.00",
        totalDeslocamento: "0.00",
        total: "100.00",
        validoAte: new Date(AGORA.getTime() + 7 * 24 * 3_600_000),
      });
    }

    return { os, sol, cli };
  }

  it("os.transicao ORCADA dispara WhatsApp orcamento_pronto + e-mail com PDF (fakes nos adapters)", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { sol } = await seedOs({
      whatsapp: destinatario,
      estado: "ORCADA",
      comOrcamento: true,
    });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();

    const resultado = await notificar(
      { tipo: "os.transicao", osId: osIds[0], estadoNovo: "ORCADA" },
      { whatsapp, email, agora: AGORA },
    );

    const minhas = whatsapp.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].template).toBe("orcamento_pronto");
    expect(minhas[0].variaveis.link).toContain(`/s/${sol.token}`);

    expect(email.enviados).toHaveLength(1);
    expect(email.enviados[0].assunto).toContain("Orçamento Disponível");
    expect(email.enviados[0].anexos?.[0]?.filename).toMatch(/^orcamento_.*\.pdf$/);

    expect(resultado.whatsapp?.status).toBe("enviado");
    expect(resultado.email?.status).toBe("sent");
  });

  it("reexecução da mesma transição PAGA não reenvia o convite à avaliação (marco)", async () => {
    const destinatario = `${PREFIXO_WPP}02`;
    await seedOs({ whatsapp: destinatario, estado: "PAGA" });
    const whatsapp = fakeWhatsapp();
    const email = fakeEmail();
    // PAGA também gera documentos (fatura/certificado) — fora do escopo deste
    // wiring; adapter de documentos injetado como no-op.
    const documentos = async () => ({ email: "skipped" as const });

    const evento = {
      tipo: "os.transicao" as const,
      osId: osIds[0],
      estadoNovo: "PAGA" as const,
    };

    await notificar(evento, { whatsapp, email, documentos, agora: AGORA });
    await notificar(evento, { whatsapp, email, documentos, agora: AGORA });

    const avaliacoes = whatsapp.chamadas.filter(
      (c) => c.destinatario === destinatario && c.template === "pedido_avaliacao",
    );
    expect(avaliacoes).toHaveLength(1);
    expect(
      email.enviados.filter((e) => e.assunto.includes("Como foi")),
    ).toHaveLength(1);
  });
});
