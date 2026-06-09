import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, like, inArray } from "drizzle-orm";
import { despacharEventoOs } from "@/notificacao/dispatcher";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955502";
// Relógio fixo dentro da janela 8h–20h (São Paulo); sem isso, o WhatsApp é
// enfileirado fora do horário comercial e o gateway nunca é chamado, tornando
// estes testes flaky por hora do dia (CI noturno enfileira em vez de enviar).
const AGORA = new Date("2026-06-05T15:00:00-03:00");

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
      return { messageId: `wamid.AVAL-${id}-${chamadas.length}` };
    },
  };
}

describe.skipIf(!hasDb)("Disparo de Pedido de Avaliação (Bloco B)", () => {
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
      await db.delete(schema.notificacaoMarco).where(inArray(schema.notificacaoMarco.osId, osIds));
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

  async function seedOs(opts: {
    whatsapp: string;
    tipo: "NORMAL" | "PREVENTIVA";
    estado: "CONCLUIDA" | "PAGA";
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
        token: `tok-aval-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste avaliacao disparo",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: opts.tipo,
        estado: opts.estado,
      })
      .returning();
    osIds.push(os.id);

    return { os, sol, cli };
  }

  it("B1 — tracer: despacharEventoOs(osId, 'PAGA') em NORMAL dispara WhatsApp pedido_avaliacao + e-mail", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { os, sol, cli } = await seedOs({ whatsapp: destinatario, tipo: "NORMAL", estado: "PAGA" });
    const gateway = fakeGateway();
    
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    await despacharEventoOs(os.id, "PAGA", {
      gateway,
      enviarEmail: mockEnviarEmail,
      agora: AGORA,
    });

    const minhas = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].template).toBe("pedido_avaliacao");
    expect(minhas[0].variaveis.link).toContain(`/s/${sol.token}/avaliar`);
    expect(Object.keys(minhas[0].variaveis)).toEqual([
      "saudacao",
      "nome_cliente",
      "link",
      "assinatura",
    ]);

    expect(emailChamadas).toHaveLength(1);
    expect(emailChamadas[0]).toEqual({ osId: os.id, estado: "PEDIDO_AVALIACAO" });
  });

  it("B2 — PREVENTIVA em CONCLUIDA dispara; NORMAL em CONCLUIDA não dispara (espera PAGA)", async () => {
    const wppPrev = `${PREFIXO_WPP}02`;
    const wppNorm = `${PREFIXO_WPP}03`;
    const prev = await seedOs({ whatsapp: wppPrev, tipo: "PREVENTIVA", estado: "CONCLUIDA" });
    const norm = await seedOs({ whatsapp: wppNorm, tipo: "NORMAL", estado: "CONCLUIDA" });

    const gateway = fakeGateway();
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    // A preventiva concluída gera o relatório (#60) via gerarDocumentosOs
    // (R2 + Resend). Este teste cobre só o disparo de avaliação, então injeta
    // um gerador de documentos no-op — sem tocar R2/Resend.
    const gerarDocumentos = async () => ({ email: "skipped" as const });

    // 1. Dispatch CONCLUIDA for PREVENTIVA (should trigger)
    await despacharEventoOs(prev.os.id, "CONCLUIDA", {
      gateway,
      enviarEmail: mockEnviarEmail,
      agora: AGORA,
      gerarDocumentos,
    });

    const prevWpp = gateway.chamadas.filter((c) => c.destinatario === wppPrev);
    expect(prevWpp).toHaveLength(1);
    expect(prevWpp[0].template).toBe("pedido_avaliacao");
    expect(emailChamadas.find((e) => e.osId === prev.os.id)).toBeDefined();

    // 2. Dispatch CONCLUIDA for NORMAL (should NOT trigger)
    await despacharEventoOs(norm.os.id, "CONCLUIDA", {
      gateway,
      enviarEmail: mockEnviarEmail,
      agora: AGORA,
      gerarDocumentos,
    });

    const normWpp = gateway.chamadas.filter((c) => c.destinatario === wppNorm);
    expect(normWpp).toHaveLength(0);
    expect(emailChamadas.find((e) => e.osId === norm.os.id && e.estado === "PEDIDO_AVALIACAO")).toBeUndefined();
  });

  it("B3 — 2 chamadas do mesmo evento → 1 envio (idempotência)", async () => {
    const destinatario = `${PREFIXO_WPP}04`;
    const { os } = await seedOs({ whatsapp: destinatario, tipo: "NORMAL", estado: "PAGA" });
    const gateway = fakeGateway();
    
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    // First call (should trigger)
    await despacharEventoOs(os.id, "PAGA", {
      gateway,
      enviarEmail: mockEnviarEmail,
      agora: AGORA,
    });

    // Second call (should NOT trigger)
    await despacharEventoOs(os.id, "PAGA", {
      gateway,
      enviarEmail: mockEnviarEmail,
      agora: AGORA,
    });

    const minhas = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(emailChamadas.filter((e) => e.osId === os.id && e.estado === "PEDIDO_AVALIACAO")).toHaveLength(1);
  });
});
