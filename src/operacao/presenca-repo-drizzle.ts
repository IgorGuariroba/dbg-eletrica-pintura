import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { confirmacaoPresenca } from "@/db/schema";
import type { PresencaRepo } from "./presenca-repo";

export function criarPresencaRepoDrizzle(db: DB): PresencaRepo {
  return {
    async confirmar(osId, ip) {
      // Idempotência pela PK (os_id): a primeira gravação vence; cliques
      // seguintes não alteram ip/timestamp. `returning` vazio = já existia.
      const inseridas = await db
        .insert(confirmacaoPresenca)
        .values({ osId, ip })
        .onConflictDoNothing()
        .returning({ osId: confirmacaoPresenca.osId });
      return { jaConfirmado: inseridas.length === 0 };
    },

    async buscar(osId) {
      const [reg] = await db
        .select({
          ip: confirmacaoPresenca.ip,
          confirmadoEm: confirmacaoPresenca.confirmadoEm,
        })
        .from(confirmacaoPresenca)
        .where(eq(confirmacaoPresenca.osId, osId))
        .limit(1);
      return reg ?? null;
    },
  };
}
