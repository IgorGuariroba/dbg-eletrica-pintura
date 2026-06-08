import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type { PreventivaRepo } from "./cancelar-preventivas-futuras";

/** Ator das transições disparadas pelo encerramento da assinatura. */
const ATOR_SISTEMA = "sistema@dbg.eletrica.br";

/**
 * Repositório das preventivas vinculadas a uma assinatura. Lista as AGENDADA da
 * assinatura (a fronteira de data fica no domínio) e cancela movendo a OS para
 * CANCELADA + histórico, num único batch (neon-http não tem transação interativa).
 */
export function criarPreventivaRepoDrizzle(db: DB): PreventivaRepo {
  return {
    async listarAgendadasDaAssinatura(assinaturaId) {
      return db
        .select({
          id: ordemServico.id,
          agendadoPara: ordemServico.agendadoPara,
        })
        .from(ordemServico)
        .where(
          and(
            eq(ordemServico.assinaturaId, assinaturaId),
            eq(ordemServico.tipo, "PREVENTIVA"),
            eq(ordemServico.estado, "AGENDADA"),
          ),
        );
    },

    async cancelar(osId, motivo, agora) {
      await db.batch([
        db
          .update(ordemServico)
          .set({ estado: "CANCELADA", tecnicoId: null })
          .where(eq(ordemServico.id, osId)),
        db.insert(transicaoOs).values({
          osId,
          estadoAnterior: "AGENDADA",
          estadoNovo: "CANCELADA",
          atorEmail: ATOR_SISTEMA,
          motivo,
          em: agora,
        }),
      ]);
    },
  };
}
