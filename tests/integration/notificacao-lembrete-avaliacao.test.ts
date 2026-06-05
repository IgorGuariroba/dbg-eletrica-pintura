import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, like, inArray } from "drizzle-orm";
import { processarLembretesAvaliacao } from "@/notificacao/lembrete-avaliacao";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955503";

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
      return { messageId: `wamid.LEMB-AVAL-${id}-${chamadas.length}` };
    },
  };
}

const AGORA = new Date("2026-06-10T13:00:00Z");

describe.skipIf(!hasDb)("Lembrete de Avaliação 48h (Bloco C)", () => {
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
      await db.delete(schema.avaliacao).where(inArray(schema.avaliacao.osId, osIds));
      await db.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.comentarioGeral).where(inArray(schema.comentarioGeral.solicitacaoId, solIds));
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedContexto(opts: {
    whatsapp: string;
    horasAtras: number;
    tipo: "NORMAL" | "PREVENTIVA";
    estado: "CONCLUIDA" | "PAGA";
    avaliada?: boolean;
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
        token: `tok-lemb-aval-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste lembrete avaliacao",
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

    // Transition em que ela se tornou avaliável
    await db.insert(schema.transicaoOs).values({
      osId: os.id,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: opts.estado,
      atorEmail: "tec@dbg.test",
      em: new Date(AGORA.getTime() - opts.horasAtras * 60 * 60 * 1000),
    });

    if (opts.avaliada) {
      await db.insert(schema.avaliacao).values({
        osId: os.id,
        nota: 5,
        atorToken: sol.token,
        ip: "127.0.0.1",
      });
    }

    return { os, sol, cli };
  }

  it("C1 — tracer: OS avaliável há ≥48h sem avaliação dispara lembrete (WhatsApp + e-mail) e seta flag", async () => {
    const destinatario = `${PREFIXO_WPP}01`;
    const { os, sol } = await seedContexto({
      whatsapp: destinatario,
      horasAtras: 49,
      tipo: "NORMAL",
      estado: "PAGA",
    });

    const gateway = fakeGateway();
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    await processarLembretesAvaliacao({
      gateway,
      agora: AGORA,
      enviarEmail: mockEnviarEmail,
    });

    const minhas = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas).toHaveLength(1);
    expect(minhas[0].template).toBe("pedido_avaliacao");
    expect(minhas[0].variaveis.link).toContain(`/s/${sol.token}/avaliar`);

    const minhasEmail = emailChamadas.filter((c) => c.osId === os.id);
    expect(minhasEmail).toHaveLength(1);
    expect(minhasEmail[0]).toEqual({ osId: os.id, estado: "PEDIDO_AVALIACAO" });

    // Verificar se a flag foi setada
    const [solAtualizada] = await db
      .select({ lembreteAvaliacaoEnviado: schema.solicitacao.lembreteAvaliacaoEnviado })
      .from(schema.solicitacao)
      .where(eq(schema.solicitacao.id, sol.id));
    expect(solAtualizada.lembreteAvaliacaoEnviado).toBe(true);
  });

  it("C2 — lembrete envia apenas 1 vez mesmo se o job rodar 2 vezes (idempotência)", async () => {
    const destinatario = `${PREFIXO_WPP}02`;
    const { os, sol } = await seedContexto({
      whatsapp: destinatario,
      horasAtras: 55,
      tipo: "NORMAL",
      estado: "PAGA",
    });

    const gateway = fakeGateway();
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    // First execution (sends reminder)
    await processarLembretesAvaliacao({
      gateway,
      agora: AGORA,
      enviarEmail: mockEnviarEmail,
    });
    const minhas1 = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas1).toHaveLength(1);
    const minhasEmail1 = emailChamadas.filter((c) => c.osId === os.id);
    expect(minhasEmail1).toHaveLength(1);

    // Second execution (should skip since flag is now true)
    await processarLembretesAvaliacao({
      gateway,
      agora: AGORA,
      enviarEmail: mockEnviarEmail,
    });
    const minhas2 = gateway.chamadas.filter((c) => c.destinatario === destinatario);
    expect(minhas2).toHaveLength(1); // still 1
    const minhasEmail2 = emailChamadas.filter((c) => c.osId === os.id);
    expect(minhasEmail2).toHaveLength(1); // still 1
  });

  it("C3 — não envia lembrete se a OS já foi avaliada ou se foi concluída/paga há <48h", async () => {
    const wppAvaliada = `${PREFIXO_WPP}03`;
    const wppRecente = `${PREFIXO_WPP}04`;

    // 1. OS already rated (avaliada: true)
    const { os: osAvaliada, sol: solAvaliada } = await seedContexto({
      whatsapp: wppAvaliada,
      horasAtras: 55,
      tipo: "NORMAL",
      estado: "PAGA",
      avaliada: true,
    });

    // 2. OS terminal but newer than 48 hours (horasAtras: 10)
    const { os: osRecente, sol: solRecente } = await seedContexto({
      whatsapp: wppRecente,
      horasAtras: 10,
      tipo: "NORMAL",
      estado: "PAGA",
      avaliada: false,
    });

    const gateway = fakeGateway();
    const emailChamadas: { osId: string; estado: string }[] = [];
    const mockEnviarEmail = async (osId: string, estado: string) => {
      emailChamadas.push({ osId, estado });
      return { status: "sent" as const, emailId: "mock-id" };
    };

    await processarLembretesAvaliacao({
      gateway,
      agora: AGORA,
      enviarEmail: mockEnviarEmail,
    });

    const minhas = gateway.chamadas.filter((c) => c.destinatario === wppAvaliada || c.destinatario === wppRecente);
    expect(minhas).toHaveLength(0);

    const minhasEmail = emailChamadas.filter((c) => c.osId === osAvaliada.id || c.osId === osRecente.id);
    expect(minhasEmail).toHaveLength(0);

    const [solAvalAtualizada] = await db
      .select({ lembreteAvaliacaoEnviado: schema.solicitacao.lembreteAvaliacaoEnviado })
      .from(schema.solicitacao)
      .where(eq(schema.solicitacao.id, solAvaliada.id));
    expect(solAvalAtualizada.lembreteAvaliacaoEnviado).toBe(false);

    const [solRecAtualizada] = await db
      .select({ lembreteAvaliacaoEnviado: schema.solicitacao.lembreteAvaliacaoEnviado })
      .from(schema.solicitacao)
      .where(eq(schema.solicitacao.id, solRecente.id));
    expect(solRecAtualizada.lembreteAvaliacaoEnviado).toBe(false);
  });
});
