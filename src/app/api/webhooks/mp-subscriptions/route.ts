import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { criarAssinaturaRepoDrizzle } from "@/assinatura/assinatura-repo-drizzle";
import { efetivarPendencias } from "@/assinatura/efetivar-pendencias";
import { derivarTipoEvento } from "@/assinatura/evento-webhook";
import { notificar } from "@/notificacao/notificar";
import { criarGatewayMercadoPagoAssinatura } from "@/lib/mercadopago";
import { notificarFalhaPagamento } from "@/assinatura/notificar-falha-pagamento";
import { processarEventoAssinatura } from "@/assinatura/processar-evento";
import { db } from "@/db/client";
import { plano } from "@/db/schema";
import { validarAssinatura } from "@/pagamento/webhook";

/**
 * Webhook de assinaturas do Mercado Pago. Valida a assinatura (mesmo esquema
 * HMAC oficial do webhook de pagamento), consulta o pre-approval por id, deriva
 * o tipo de evento e reflete o status na assinatura de forma idempotente.
 *
 * Idempotência: `id` da notificação vira PK em `assinatura_evento`; notificação
 * duplicada não reaplica o efeito (ADR-0006: inadimplência é do MP).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    id?: string | number;
    data?: { id?: string | number };
  };
  const dataId = url.searchParams.get("data.id") ?? body?.data?.id;
  const requestId = request.headers.get("x-request-id") ?? "";

  // Fail-closed: sem segredo configurado não há como validar a origem. Aceitar
  // (HMAC com chave vazia) abriria a porta para notificações forjadas.
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook não configurado" },
      { status: 401 },
    );
  }

  const ok =
    dataId != null &&
    validarAssinatura({
      dataId: String(dataId),
      requestId,
      xSignature: request.headers.get("x-signature") ?? "",
      secret,
    });
  if (!ok) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  // Chave de idempotência: o `id` da notificação do MP — estável por evento e
  // reusado nas retentativas da MESMA notificação. Vem no corpo (v2) ou no query
  // `id` (v1). NÃO cair para `x-request-id` (muda a cada entrega → retry seria
  // reprocessado) nem para `data.id` (= preapproval → colapsaria todos os
  // eventos da assinatura). Sem id estável, não há como garantir idempotência:
  // 400 faz o MP reentregar.
  const notificationId = body?.id ?? url.searchParams.get("id");
  if (notificationId == null || notificationId === "") {
    return NextResponse.json(
      { error: "notificação sem id" },
      { status: 400 },
    );
  }

  const recurso = await criarGatewayMercadoPagoAssinatura().buscarAssinatura(
    String(dataId),
  );
  const tipo = derivarTipoEvento(recurso.status);
  if (!tipo) {
    // Status sem mapeamento — 200 evita retry infinito do MP.
    return NextResponse.json({ ignorado: true });
  }

  const eventId = String(notificationId);
  const { aplicado } = await processarEventoAssinatura(
    { eventId, preapprovalIdMp: String(dataId), tipo },
    {
      repo: criarAssinaturaRepoDrizzle(db),
      // Boas-vindas só na 1ª ativação (gate em processarEventoAssinatura).
      // Reaproveita o `next_payment_date` já consultado acima via deps.
      enviarBoasVindas: async (preapprovalIdMp) => {
        await notificar(
          { tipo: "assinatura.criada", preapprovalIdMp },
          { mpAssinatura: { buscarAssinatura: async () => recurso } },
        );
      },
      // Falha de pagamento (slice #58): WhatsApp + e-mail com link MP. A
      // idempotência (1 falha = 1 notificação) vem de `assinatura_evento`:
      // só notifica quando o evento foi aplicado pela 1ª vez.
      notificarFalha: (preapprovalIdMp) => {
        void notificarFalhaPagamento(preapprovalIdMp);
      },
    },
  );

  // Efetivação no fim do ciclo (slice #58): qualquer webhook desta assinatura
  // tenta aplicar a pendência agendada (downgrade/cancelamento) se a
  // `data_efetivacao` já chegou. Idempotente — no-op fora da janela.
  await efetivarPendencias(String(dataId), {
    repo: criarAssinaturaRepoDrizzle(db),
    gatewayAssinatura: criarGatewayMercadoPagoAssinatura(),
    obterPrecoPlano: async (planoId) => {
      const [row] = await db
        .select({ preco: plano.preco })
        .from(plano)
        .where(eq(plano.id, planoId))
        .limit(1);
      return row ? Number(row.preco) : 0;
    },
  });

  return NextResponse.json({ ok: true, aplicado });
}
