import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";
import { criarGatewayMercadoPago } from "@/pagamento/mercadopago-client";
import { criarPagamentoRepoDrizzle } from "@/pagamento/pagamento-repo-drizzle";
import { processarPagamento } from "@/pagamento/processar-pagamento";
import {
  MetadataOsAusenteError,
  parsearNotificacao,
  validarAssinatura,
} from "@/pagamento/webhook";

/**
 * Webhook de pagamento do Mercado Pago. Valida a assinatura (esquema oficial),
 * consulta o pagamento por id, e dispara a transição CONCLUIDA → PAGA de forma
 * idempotente. O corpo só traz `data.id`; status/valor/metadata vêm da consulta.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    data?: { id?: string | number };
  };
  const dataId = url.searchParams.get("data.id") ?? body?.data?.id;
  const secret = process.env.MP_WEBHOOK_SECRET ?? "";

  const ok =
    dataId != null &&
    validarAssinatura({
      dataId: String(dataId),
      requestId: request.headers.get("x-request-id") ?? "",
      xSignature: request.headers.get("x-signature") ?? "",
      secret,
    });
  if (!ok) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const recurso = await criarGatewayMercadoPago().buscarPagamento(
    String(dataId),
  );

  let dados: ReturnType<typeof parsearNotificacao>;
  try {
    dados = parsearNotificacao(recurso);
  } catch (e) {
    if (e instanceof MetadataOsAusenteError) {
      // Sem OS no metadata não há o que processar — 200 evita retry infinito.
      return NextResponse.json({ ignorado: true });
    }
    throw e;
  }

  const { transitadas } = await processarPagamento(dados, {
    pagamentoRepo: criarPagamentoRepoDrizzle(db),
    transicaoRepo: criarTransicaoRepoDrizzle(db),
  });

  return NextResponse.json({ ok: true, transitadas });
}
