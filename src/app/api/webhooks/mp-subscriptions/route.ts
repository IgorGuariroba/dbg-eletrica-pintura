import { NextResponse } from "next/server";
import { criarAssinaturaRepoDrizzle } from "@/assinatura/assinatura-repo-drizzle";
import { derivarTipoEvento } from "@/assinatura/evento-webhook";
import { criarGatewayMercadoPagoAssinatura } from "@/assinatura/mercadopago-assinatura";
import { processarEventoAssinatura } from "@/assinatura/processar-evento";
import { db } from "@/db/client";
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
  const secret = process.env.MP_WEBHOOK_SECRET ?? "";

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

  const recurso = await criarGatewayMercadoPagoAssinatura().buscarAssinatura(
    String(dataId),
  );
  const tipo = derivarTipoEvento(recurso.status);
  if (!tipo) {
    // Status sem mapeamento — 200 evita retry infinito do MP.
    return NextResponse.json({ ignorado: true });
  }

  // Id da notificação como chave de idempotência; cai para request-id/data.id.
  const eventId = String(body?.id ?? requestId ?? dataId);
  const { aplicado } = await processarEventoAssinatura(
    { eventId, preapprovalIdMp: String(dataId), tipo },
    { repo: criarAssinaturaRepoDrizzle(db) },
  );

  return NextResponse.json({ ok: true, aplicado });
}
