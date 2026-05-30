import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type {
  OsReagendavel,
  ReagendamentoRepo,
  RegistroTransicao,
} from "./reagendamento";

export function criarReagendamentoRepoDrizzle(db: DB): ReagendamentoRepo {
  // Histórico da transição, montado para entrar no mesmo batch da atualização.
  function registroTransicao(osId: string, r: RegistroTransicao) {
    return db.insert(transicaoOs).values({
      osId,
      estadoAnterior: r.estadoAnterior,
      estadoNovo: r.estadoNovo,
      atorEmail: r.atorEmail,
      motivo: r.motivo,
      em: r.em,
    });
  }

  return {
    async carregar(osId): Promise<OsReagendavel | null> {
      const [os] = await db
        .select({
          estado: ordemServico.estado,
          tecnicoId: ordemServico.tecnicoId,
          agendadoPara: ordemServico.agendadoPara,
        })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      return os ?? null;
    },

    async cancelar(osId, novoEstado, registro): Promise<void> {
      // Atomicidade via batch (neon-http não tem transação interativa):
      // devolve à fila (zera técnico + regride estado) e registra o histórico
      // no mesmo round-trip.
      await db.batch([
        db
          .update(ordemServico)
          .set({ estado: novoEstado, tecnicoId: null })
          .where(eq(ordemServico.id, osId)),
        registroTransicao(osId, registro),
      ]);
    },

    async reagendar(osId, novoSlot, registro): Promise<void> {
      await db.batch([
        db
          .update(ordemServico)
          .set({ estado: "AGENDADA", agendadoPara: novoSlot })
          .where(eq(ordemServico.id, osId)),
        registroTransicao(osId, registro),
      ]);
    },
  };
}
