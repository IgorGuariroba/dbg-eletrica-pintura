import { db } from "@/db/client";
import { notificacaoMarco } from "@/db/schema";

/**
 * Reivindica o Marco de Notificação (refId, evento) ANTES de enviar: insert
 * com onConflictDoNothing na UNIQUE (ref_id, marco). Devolve `true` se ganhou
 * a corrida (pode enviar); `false` se o marco já existia (reexecução → no-op).
 *
 * A referência é genérica: id de OS para eventos de OS, id de assinatura para
 * eventos de assinatura. Garantia do contexto Notificação, não do emissor.
 * Limitação consciente: claim ganho + falha de canal posterior não reenvia
 * (sem retry parcial por canal). Ver CONTEXT.md.
 */
export async function claimMarco(refId: string, evento: string): Promise<boolean> {
  const claim = await db
    .insert(notificacaoMarco)
    .values({ refId, marco: evento })
    .onConflictDoNothing({
      target: [notificacaoMarco.refId, notificacaoMarco.marco],
    })
    .returning({ id: notificacaoMarco.id });
  return claim.length > 0;
}
