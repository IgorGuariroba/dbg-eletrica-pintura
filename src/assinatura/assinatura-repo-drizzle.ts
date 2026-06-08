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

    async carregarPorPreapproval(preapprovalIdMp) {
      const [row] = await db
        .select({
          id: assinatura.id,
          clienteId: assinatura.clienteId,
          planoId: assinatura.planoId,
          status: assinatura.status,
          fimCicloAtual: assinatura.fimCicloAtual,
          planoPendenteId: assinatura.planoPendenteId,
          cancelamentoPendente: assinatura.cancelamentoPendente,
          dataEfetivacao: assinatura.dataEfetivacao,
        })
        .from(assinatura)
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp))
        .limit(1);
      return row ?? null;
    },

    async marcarCancelamentoPendente(preapprovalIdMp, dados) {
      await db
        .update(assinatura)
        .set({
          cancelamentoPendente: true,
          dataEfetivacao: dados.dataEfetivacao,
          motivoCancelamento: dados.motivo,
        })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
    },

    async marcarDowngradePendente(preapprovalIdMp, dados) {
      await db
        .update(assinatura)
        .set({
          planoPendenteId: dados.planoPendenteId,
          dataEfetivacao: dados.dataEfetivacao,
        })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
    },

    async efetivarCancelamento(preapprovalIdMp, em) {
      await db
        .update(assinatura)
        .set({
          status: "CANCELADA",
          canceladoEm: em,
          cancelamentoPendente: false,
          dataEfetivacao: null,
        })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
    },

    async efetivarDowngrade(preapprovalIdMp, novoPlanoId) {
      await db
        .update(assinatura)
        .set({
          planoId: novoPlanoId,
          planoPendenteId: null,
          dataEfetivacao: null,
        })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
    },

    async trocarPlano(preapprovalIdMp, novoPlanoId) {
      await db
        .update(assinatura)
        .set({ planoId: novoPlanoId })
        .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp));
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
