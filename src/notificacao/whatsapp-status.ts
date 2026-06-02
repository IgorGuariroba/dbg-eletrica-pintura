import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificacaoWhatsapp } from "@/db/schema";
import type { EventoStatus } from "./whatsapp-webhook";

/**
 * Aplica atualizações de status (delivered/read/failed) aos registros de envio,
 * correlacionando por `message_id`. Idempotente: reaplicar o mesmo evento
 * apenas reescreve o mesmo status. Eventos sem registro correspondente são
 * ignorados (mensagem não originada por nós).
 */
export async function aplicarEventosStatus(
  eventos: EventoStatus[],
): Promise<{ atualizados: number }> {
  let atualizados = 0;
  for (const evento of eventos) {
    const res = await db
      .update(notificacaoWhatsapp)
      .set({ status: evento.status })
      .where(eq(notificacaoWhatsapp.messageId, evento.messageId))
      .returning({ id: notificacaoWhatsapp.id });
    atualizados += res.length;
  }
  return { atualizados };
}
