import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { despacharEventoOs } from "@/notificacao/dispatcher";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";
import type { NotificacaoResultado } from "@/notificacao/notificador";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// WhatsApp de seed reconhecível — cleanup apaga tudo que começa com este prefixo.
const PREFIXO_WPP = "5511955500";

/** Gateway falso que registra as chamadas e devolve um message_id único. */
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
      return { messageId: `wamid.DISPATCH-${chamadas.length}` };
    },
  };
}

/** Sender de e-mail falso: registra as chamadas, não toca R2 nem Resend. */
function fakeEmail(): {
  chamadas: { osId: string; estado: string }[];
  enviar: (osId: string, estado: string) => Promise<NotificacaoResultado>;
} {
  const chamadas: { osId: string; estado: string }[] = [];
  return {
    chamadas,
    async enviar(osId, estado) {
      chamadas.push({ osId, estado });
      return { status: "sent", emailId: `fake-${chamadas.length}` };
    },
  };
}

// Dentro da janela 8h–20h BRT (13h UTC = 10h BRT): WhatsApp envia na hora.
const DENTRO_HORARIO = new Date("2026-06-02T13:00:00Z");

describe.skipIf(!hasDb)("Notificação Dispatcher (Slice 2 — #46)", () => {
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
      await db.delete(schema.orcamentoItem).where(
        inArray(
          schema.orcamentoItem.orcamentoId,
          db.select({ id: schema.orcamento.id }).from(schema.orcamento).where(inArray(schema.orcamento.osId, osIds)),
        ),
      );
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

  async function seed(opts: {
    whatsapp: string;
    email?: string | null;
    estado?: "NOVA" | "AGENDADA" | "EM_EXECUCAO";
    comOrcamento?: boolean;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [tec] = await db
      .insert(schema.membro)
      .values({ nome: `Tec ${r}`, email: `tec-${r}@dbg.test`, isTecnico: true })
      .returning();
    tecIds.push(tec.id);

    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp: opts.whatsapp,
        email: opts.email === undefined ? `cli-${r}@dbg.test` : opts.email,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-disp-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "Serviço de teste dispatcher",
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
        estado: opts.estado ?? "NOVA",
        tecnicoId: tec.id,
      })
      .returning();
    osIds.push(os.id);

    if (opts.comOrcamento) {
      await db.insert(schema.orcamento).values({
        osId: os.id,
        tokenAprovacao: `apr-${r}`,
        total: "280.00",
        totalMaoDeObra: "250.00",
        totalDeslocamento: "30.00",
        validoAte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    return { os, sol, cli, tec };
  }

  it("transição ORÇADA dispara WhatsApp orcamento_pronto + e-mail", async () => {
    const destinatario = `${PREFIXO_WPP}001`;
    const { os, cli } = await seed({ whatsapp: destinatario, comOrcamento: true });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await despacharEventoOs(os.id, "ORCADA", {
      gateway,
      agora: DENTRO_HORARIO,
      enviarEmail: email.enviar,
    });

    // WhatsApp: template correto, para o número do cliente.
    expect(gateway.chamadas).toHaveLength(1);
    expect(gateway.chamadas[0].template).toBe("orcamento_pronto");
    expect(gateway.chamadas[0].destinatario).toBe(destinatario);
    expect(res.whatsapp?.status).toBe("enviado");

    // Ordem posicional dos params casa com o catálogo (layout do template Meta).
    expect(Object.keys(gateway.chamadas[0].variaveis)).toEqual([
      "saudacao",
      "nome_cliente",
      "link",
      "assinatura",
    ]);

    // E-mail: delegado ao notificador para a mesma transição.
    expect(email.chamadas).toEqual([{ osId: os.id, estado: "ORCADA" }]);
    expect(res.email?.status).toBe("sent");

    // Registro persistido na notificacao_whatsapp.
    const [registro] = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.destinatario, destinatario))
      .limit(1);
    expect(registro?.template).toBe("orcamento_pronto");

    void cli;
  });

  it("cliente sem WhatsApp válido: pula WhatsApp e ainda envia e-mail", async () => {
    const { os } = await seed({ whatsapp: "invalido", comOrcamento: true });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await despacharEventoOs(os.id, "ORCADA", {
      gateway,
      agora: DENTRO_HORARIO,
      enviarEmail: email.enviar,
    });

    expect(gateway.chamadas).toHaveLength(0);
    expect(res.whatsapp?.status).toBe("skipped");
    expect(res.whatsapp?.motivo).toContain("WhatsApp");
    // E-mail segue normalmente — os canais são independentes.
    expect(email.chamadas).toHaveLength(1);
    expect(res.email?.status).toBe("sent");
  });

  it("transição A_CAMINHO dispara WhatsApp tecnico_a_caminho e NÃO envia e-mail", async () => {
    const destinatario = `${PREFIXO_WPP}003`;
    const { os } = await seed({ whatsapp: destinatario, estado: "AGENDADA" });
    const gateway = fakeGateway();
    const email = fakeEmail();

    const res = await despacharEventoOs(os.id, "A_CAMINHO", {
      gateway,
      agora: DENTRO_HORARIO,
      enviarEmail: email.enviar,
    });

    expect(gateway.chamadas).toHaveLength(1);
    expect(gateway.chamadas[0].template).toBe("tecnico_a_caminho");
    expect(res.whatsapp?.status).toBe("enviado");
    // Ação imediata: sem documento, sem e-mail.
    expect(email.chamadas).toHaveLength(0);
    expect(res.email).toBeUndefined();
  });
});
