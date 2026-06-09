import type { DB } from "@/db/client";
import { remarketingEnviado } from "@/db/schema";
import type { RemarketingEnviadoRepo } from "./enviado-repo";

export function criarRemarketingEnviadoRepoDrizzle(db: DB): RemarketingEnviadoRepo {
  return {
    async claim(gatilho, clienteId, contexto) {
      const claim = await db
        .insert(remarketingEnviado)
        .values({
          gatilho,
          clienteId,
          contexto,
        })
        .onConflictDoNothing({
          target: [
            remarketingEnviado.gatilho,
            remarketingEnviado.clienteId,
            remarketingEnviado.contexto,
          ],
        })
        .returning({ id: remarketingEnviado.id });

      return claim.length > 0;
    },
  };
}
