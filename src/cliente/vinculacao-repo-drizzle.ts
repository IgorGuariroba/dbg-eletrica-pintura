import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ehViolacaoUnica } from "@/db/client";
import {
  cliente,
  vinculacaoGooglePendente,
  vinculacaoGoogleLog,
  notificacaoInApp,
} from "@/db/schema";
import type {
  VinculacaoRepo,
  PendenteVinculacao,
} from "./vinculacao-repo";
import { WhatsappJaVinculadoError } from "./vinculacao-repo";

export function criarVinculacaoRepoDrizzle(db: DB): VinculacaoRepo {
  return {
    async buscarClientePorWhatsapp(whatsapp: string) {
      const [row] = await db
        .select({ id: cliente.id, googleEmail: cliente.googleEmail })
        .from(cliente)
        .where(eq(cliente.whatsapp, whatsapp))
        .limit(1);
      return row ?? null;
    },

    async buscarVinculoPorGoogleEmail(googleEmail: string) {
      const [row] = await db
        .select({ whatsapp: cliente.whatsapp })
        .from(cliente)
        .where(eq(cliente.googleEmail, googleEmail))
        .limit(1);
      return row ?? null;
    },

    async salvarPendente(p: PendenteVinculacao) {
      await db
        .insert(vinculacaoGooglePendente)
        .values({
          googleEmail: p.googleEmail,
          whatsapp: p.whatsapp,
          codigo: p.codigo,
          expiraEm: p.expiraEm,
        })
        .onConflictDoUpdate({
          target: [vinculacaoGooglePendente.googleEmail],
          set: {
            whatsapp: p.whatsapp,
            codigo: p.codigo,
            expiraEm: p.expiraEm,
          },
        });
    },

    async buscarPendente(googleEmail: string) {
      const [row] = await db
        .select()
        .from(vinculacaoGooglePendente)
        .where(eq(vinculacaoGooglePendente.googleEmail, googleEmail))
        .limit(1);
      return row ?? null;
    },

    async removerPendente(googleEmail: string) {
      await db
        .delete(vinculacaoGooglePendente)
        .where(eq(vinculacaoGooglePendente.googleEmail, googleEmail));
    },

    async vincular(whatsapp: string, googleEmail: string) {
      try {
        await db
          .update(cliente)
          .set({ googleEmail })
          .where(eq(cliente.whatsapp, whatsapp));
      } catch (e) {
        if (ehViolacaoUnica(e)) {
          throw new WhatsappJaVinculadoError(whatsapp);
        }
        throw e;
      }
    },

    async desvincular(whatsapp: string) {
      const res = await db
        .update(cliente)
        .set({ googleEmail: null })
        .where(eq(cliente.whatsapp, whatsapp))
        .returning();
      return res.length > 0;
    },

    async registrarLog(e: {
      clienteId: string;
      googleEmail: string;
      whatsapp: string;
      evento: "VINCULADO" | "DESVINCULADO";
      atorEmail: string;
    }) {
      await db.insert(vinculacaoGoogleLog).values({
        clienteId: e.clienteId,
        googleEmail: e.googleEmail,
        whatsapp: e.whatsapp,
        evento: e.evento,
        atorEmail: e.atorEmail,
      });
    },

    async notificarEquipe(input: { whatsapp: string; codigo: string }) {
      await db.insert(notificacaoInApp).values({
        destinatarioModulo: "EQUIPE",
        titulo: "Código de Vinculação Google",
        mensagem: `Código para WhatsApp ${input.whatsapp}: ${input.codigo}`,
        lida: false,
      });
    },
  };
}
