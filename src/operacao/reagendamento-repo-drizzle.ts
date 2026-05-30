import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type {
  OsReagendavel,
  ReagendamentoRepo,
  RegistroTransicao,
} from "./reagendamento";

export function criarReagendamentoRepoDrizzle(db: DB): ReagendamentoRepo {
  async function registrar(osId: string, r: RegistroTransicao) {
    await db.insert(transicaoOs).values({
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
      // Devolve à fila: zera o técnico e regride o estado.
      await db
        .update(ordemServico)
        .set({ estado: novoEstado, tecnicoId: null })
        .where(eq(ordemServico.id, osId));
      await registrar(osId, registro);
    },

    async reagendar(osId, novoSlot, registro): Promise<void> {
      await db
        .update(ordemServico)
        .set({ estado: "AGENDADA", agendadoPara: novoSlot })
        .where(eq(ordemServico.id, osId));
      await registrar(osId, registro);
    },
  };
}
