import { eq } from "drizzle-orm";
import { type DB, ehViolacaoUnica } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type { ReservaSlotRepo, ReservarSlotInput } from "./reserva-slot";
import { SlotIndisponivelError } from "./reserva-slot";

export function criarReservaSlotRepoDrizzle(db: DB): ReservaSlotRepo {
  return {
    async buscarEstadoOs(osId: string): Promise<{ estado: string } | null> {
      const [os] = await db
        .select({ estado: ordemServico.estado })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      return os ?? null;
    },

    async reservar(input: ReservarSlotInput): Promise<void> {
      const { osId, tecnicoId, agendadoPara, atorEmail } = input;

      const [currentOs] = await db
        .select({ estado: ordemServico.estado })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);

      if (!currentOs) {
        return;
      }

      try {
        await db.batch([
          db
            .update(ordemServico)
            .set({
              estado: "AGENDADA",
              tecnicoId,
              agendadoPara,
            })
            .where(eq(ordemServico.id, osId)),
          db.insert(transicaoOs).values({
            osId,
            estadoAnterior: currentOs.estado,
            estadoNovo: "AGENDADA",
            atorEmail,
            em: new Date(),
          }),
        ]);
      } catch (error) {
        if (ehViolacaoUnica(error)) {
          throw new SlotIndisponivelError(tecnicoId, agendadoPara);
        }
        throw error;
      }
    },
  };
}
