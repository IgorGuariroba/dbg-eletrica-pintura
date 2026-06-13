import type { GatilhoRemarketingId } from "./gatilhos";

export interface RemarketingEnviadoRepo {
  claim(gatilho: GatilhoRemarketingId, clienteId: string, contexto: string): Promise<boolean>;
}

// ============================================================
// Implementação Drizzle (inlinada — auditoria #165: seam hipotético,
// um adapter só; regra e query juntas no módulo de domínio)
// ============================================================

import type { DB } from "@/db/client";
import { remarketingEnviado } from "@/db/schema";

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
