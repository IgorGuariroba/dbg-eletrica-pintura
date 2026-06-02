import { config } from "dotenv";
import { createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { enviarTemplate } from "@/notificacao/enviar-template";
import { processarFilaWhatsapp } from "@/notificacao/processar-fila";
import { POST } from "@/app/api/webhooks/whatsapp/route";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const APP_SECRET = "app-secret-integr";

/** Monta um POST de webhook assinado como a Meta faria. */
function reqWebhook(corpo: unknown): Request {
  const payload = JSON.stringify(corpo);
  const assinatura =
    "sha256=" + createHmac("sha256", APP_SECRET).update(payload).digest("hex");
  return new Request("https://dbg.app/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": assinatura,
    },
    body: payload,
  });
}

/** Payload de atualização de status no formato da Cloud API. */
function eventoStatus(messageId: string, status: string): unknown {
  return {
    entry: [
      {
        changes: [{ value: { statuses: [{ id: messageId, status }] } }],
      },
    ],
  };
}

// Telefone de seed reconhecível — cleanup apaga tudo que começa com este prefixo.
const PREFIXO_TESTE = "5511900000";

/** Gateway falso que registra as chamadas e devolve um message_id fixo. */
function fakeGateway(messageId = "wamid.TESTE123"): GatewayWhatsApp & {
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
      // Sufixo único por chamada: a Meta nunca repete wamid e a coluna é UNIQUE.
      return { messageId: `${messageId}-${chamadas.length}` };
    },
  };
}

describe.skipIf(!hasDb)("Notificação WhatsApp Cloud API (Slice 1 — #45)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
    process.env.META_APP_SECRET = APP_SECRET;
  });

  afterEach(async () => {
    const { like } = await import("drizzle-orm");
    await db
      .delete(schema.notificacaoWhatsapp)
      .where(like(schema.notificacaoWhatsapp.destinatario, `${PREFIXO_TESTE}%`));
    await db
      .delete(schema.filaWhatsapp)
      .where(like(schema.filaWhatsapp.destinatario, `${PREFIXO_TESTE}%`));
  });

  it("dentro do horário restrito (8h–20h) envia pelo gateway e persiste o registro", async () => {
    const destinatario = `${PREFIXO_TESTE}001`;
    const gateway = fakeGateway("wamid.OK1");

    const res = await enviarTemplate(
      {
        destinatario,
        template: "orcamento_pronto",
        variaveis: { nome_cliente: "José", link: "https://dbg/s/abc" },
      },
      { gateway, agora: new Date("2026-06-02T13:00:00Z") }, // 10h BRT
    );

    expect(res.status).toBe("enviado");
    expect(res.messageId).toBe("wamid.OK1-1");
    expect(gateway.chamadas).toHaveLength(1);
    expect(gateway.chamadas[0]).toMatchObject({
      destinatario,
      template: "orcamento_pronto",
    });

    const [registro] = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.destinatario, destinatario))
      .limit(1);

    expect(registro).toBeDefined();
    expect(registro.status).toBe("enviado");
    expect(registro.messageId).toBe("wamid.OK1-1");
    expect(registro.template).toBe("orcamento_pronto");
  });

  it("fora do horário restrito enfileira na fila e não chama o gateway", async () => {
    const destinatario = `${PREFIXO_TESTE}002`;
    const gateway = fakeGateway();

    const res = await enviarTemplate(
      {
        destinatario,
        template: "lembrete_pagamento",
        variaveis: { nome_cliente: "Ana", valor: "250,00", link: "https://dbg/x" },
      },
      { gateway, agora: new Date("2026-06-03T02:00:00Z") }, // 23h BRT
    );

    expect(res.status).toBe("enfileirado");
    expect(res.messageId).toBeUndefined();
    expect(gateway.chamadas).toHaveLength(0);

    const [naFila] = await db
      .select()
      .from(schema.filaWhatsapp)
      .where(eq(schema.filaWhatsapp.destinatario, destinatario))
      .limit(1);
    expect(naFila).toBeDefined();
    expect(naFila.status).toBe("pendente");
    expect(naFila.template).toBe("lembrete_pagamento");

    const registros = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.destinatario, destinatario));
    expect(registros).toHaveLength(0);
  });

  it("emergência Premium fora do horário bypassa a fila e envia ao admin, não ao cliente", async () => {
    const cliente = `${PREFIXO_TESTE}003`;
    const admin = `${PREFIXO_TESTE}999`;
    const gateway = fakeGateway("wamid.ALERTA");

    const res = await enviarTemplate(
      {
        destinatario: cliente,
        template: "garantia_acionada",
        variaveis: { nome_cliente: "Premium", os_id: "abc123" },
        prioridade: "emergencia_premium",
      },
      {
        gateway,
        adminWhatsapp: admin,
        agora: new Date("2026-06-03T05:00:00Z"), // 2h BRT — fora do horário
      },
    );

    expect(res.status).toBe("enviado");
    expect(gateway.chamadas).toHaveLength(1);
    expect(gateway.chamadas[0].destinatario).toBe(admin);

    // Nada vai pra fila e o registro fica no nome do admin (não do cliente).
    const fila = await db
      .select()
      .from(schema.filaWhatsapp)
      .where(eq(schema.filaWhatsapp.destinatario, cliente));
    expect(fila).toHaveLength(0);

    const [registro] = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.destinatario, admin))
      .limit(1);
    expect(registro).toBeDefined();
    expect(registro.status).toBe("enviado");
  });

  it("webhook POST atualiza o status do registro pelo message_id", async () => {
    const destinatario = `${PREFIXO_TESTE}006`;
    const messageId = "wamid.STATUS006";
    await db.insert(schema.notificacaoWhatsapp).values({
      destinatario,
      template: "pedido_avaliacao",
      variaveis: { nome_cliente: "Joana", link: "https://dbg/a" },
      status: "enviado",
      messageId,
    });

    const res = await POST(reqWebhook(eventoStatus(messageId, "delivered")));
    expect(res.status).toBe(200);

    const [registro] = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.messageId, messageId))
      .limit(1);
    expect(registro.status).toBe("entregue");
  });

  it("webhook POST duplicado é idempotente (sem efeito duplo)", async () => {
    const destinatario = `${PREFIXO_TESTE}007`;
    const messageId = "wamid.STATUS007";
    await db.insert(schema.notificacaoWhatsapp).values({
      destinatario,
      template: "tecnico_a_caminho",
      variaveis: { nome_cliente: "Rui", nome_tecnico: "Diego", eta: "15min" },
      status: "enviado",
      messageId,
    });

    await POST(reqWebhook(eventoStatus(messageId, "read")));
    await POST(reqWebhook(eventoStatus(messageId, "read")));

    const registros = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.messageId, messageId));
    expect(registros).toHaveLength(1);
    expect(registros[0].status).toBe("lido");
  });

  it("webhook POST rejeita assinatura inválida com 401", async () => {
    const req = new Request("https://dbg.app/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=deadbeef" },
      body: JSON.stringify(eventoStatus("wamid.X", "read")),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("processarFilaWhatsapp envia os pendentes, registra e marca como enviado", async () => {
    const destinatario = `${PREFIXO_TESTE}008`;
    await db.insert(schema.filaWhatsapp).values([
      {
        destinatario,
        template: "orcamento_pronto",
        variaveis: { nome_cliente: "Lia", link: "https://dbg/s/1" },
        status: "pendente",
      },
      {
        destinatario,
        template: "pedido_avaliacao",
        variaveis: { nome_cliente: "Lia", link: "https://dbg/s/2" },
        status: "pendente",
      },
    ]);

    const gateway = fakeGateway("wamid.FILA");
    const res = await processarFilaWhatsapp({ gateway });

    expect(res.processados).toBe(2);
    expect(gateway.chamadas).toHaveLength(2);

    const fila = await db
      .select()
      .from(schema.filaWhatsapp)
      .where(eq(schema.filaWhatsapp.destinatario, destinatario));
    expect(fila.every((f) => f.status === "enviado")).toBe(true);
    expect(fila.every((f) => f.processadoEm !== null)).toBe(true);

    const registros = await db
      .select()
      .from(schema.notificacaoWhatsapp)
      .where(eq(schema.notificacaoWhatsapp.destinatario, destinatario));
    expect(registros).toHaveLength(2);
    expect(registros.every((r) => r.status === "enviado")).toBe(true);
  });
});
