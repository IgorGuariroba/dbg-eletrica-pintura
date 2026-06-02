import { NextResponse } from "next/server";
import { aplicarEventosStatus } from "@/notificacao/whatsapp-status";
import {
  parsearEventosStatus,
  validarAssinatura,
} from "@/notificacao/whatsapp-webhook";

/**
 * Verificação inicial do webhook da WhatsApp Cloud API. A Meta chama com
 * `hub.mode=subscribe`, `hub.verify_token` e `hub.challenge`. Se o token bate
 * com `META_WEBHOOK_VERIFY_TOKEN`, devolvemos o challenge em texto puro.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (modo === "subscribe" && esperado && token === esperado) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "verificação inválida" }, { status: 403 });
}

/**
 * Recebe eventos da Cloud API (status de entrega das mensagens). Valida a
 * assinatura `X-Hub-Signature-256` contra `META_APP_SECRET` e aplica as
 * atualizações de status por `message_id`. Idempotente: reprocessar o mesmo
 * evento reescreve o mesmo status, sem efeito duplicado.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256") ?? "";
  const secret = process.env.META_APP_SECRET ?? "";

  if (!validarAssinatura({ payload, assinatura, secret })) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(payload);
  } catch {
    corpo = {};
  }

  const eventos = parsearEventosStatus(corpo);
  const { atualizados } = await aplicarEventosStatus(eventos);

  return NextResponse.json({ ok: true, atualizados });
}
