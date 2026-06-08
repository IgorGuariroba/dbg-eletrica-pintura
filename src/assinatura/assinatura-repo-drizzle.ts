import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, assinaturaEvento } from "@/db/schema";
import type { AssinaturaRepo } from "./assinatura-repo";

export function criarAssinaturaRepoDrizzle(db: DB): AssinaturaRepo {
  return {
    async criar(a) {
      const [row] = await db
        .insert(assinatura)
        .values({
          clienteId: a.clienteId,
          planoId: a.planoId,
          preapprovalIdMp: a.preapprovalIdMp,
        })
        .returning({ id: assinatura.id });
      return { id: row.id };
    },

    async registrarEvento(e) {
      // Idempotência pela PK `event_id`: a primeira gravação vence; evento
      // duplicado não insere. `returning` vazio = já existia.
      const inseridas = await db
        .insert(assinaturaEvento)
        .values({
          eventId: e.eventId,
          preapprovalIdMp: e.preapprovalIdMp,
          tipo: e.tipo,
        })
        .onConflictDoNothing()
        .returning({ eventId: assinaturaEvento.eventId });
      return inseridas.length > 0;
    },

    async atualizarStatus(preapprovalIdMp, patch) {
      await db
        .update(assinatura)
        .set({
          status: patch.status,
          inicio: patch.inicio,
          fimCicloAtual: patch.fimCicloAtual,
          canceladoEm: patch.canceladoEm,
          motivoCancelamento: patch.motivoCancelamento,
        })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
    },

    async statusAtual(preapprovalIdMp) {
      const [row] = await db
        .select({ status: assinatura.status })
        .from(assinatura)
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp))
        .limit(1);
      return row?.status ?? null;
    },

    async assinaturaAtivaDe(clienteId, planoId) {
      // PENDENTE conta: a 1ª autorização ainda pode chegar pelo webhook; abrir
      // outro pre-approval em paralelo arriscaria cobrança dupla.
      const [row] = await db
        .select({ id: assinatura.id })
        .from(assinatura)
        .where(
          and(
            eq(assinatura.clienteId, clienteId),
            eq(assinatura.planoId, planoId),
            inArray(assinatura.status, ["PENDENTE", "ATIVA"]),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
  };
}
