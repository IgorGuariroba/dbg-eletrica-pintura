import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { cliente } from "@/db/schema";
import type { ClienteAssinaturaRepo } from "./cliente-assinatura-repo";

export function criarClienteAssinaturaRepoDrizzle(
  db: DB,
): ClienteAssinaturaRepo {
  return {
    async buscarPorWhatsapp(whatsapp) {
      const [row] = await db
        .select({ id: cliente.id })
        .from(cliente)
        .where(eq(cliente.whatsapp, whatsapp))
        .limit(1);
      return row ?? null;
    },

    async criar(c) {
      // Upsert por UNIQUE(whatsapp): atômico, evita corrida com cadastro vindo
      // de outra origem (OS, vinculação). O cliente que assina chega autenticado
      // pelo Google → guarda email e googleEmail; preserva cadastro existente.
      const [row] = await db
        .insert(cliente)
        .values({
          nome: c.nome,
          whatsapp: c.whatsapp,
          email: c.email,
          googleEmail: c.email,
        })
        .onConflictDoUpdate({
          target: cliente.whatsapp,
          set: {
            nome: sql`coalesce(nullif(${cliente.nome}, ''), excluded.nome)`,
            email: sql`coalesce(${cliente.email}, excluded.email)`,
            googleEmail: sql`coalesce(${cliente.googleEmail}, excluded.google_email)`,
          },
        })
        .returning({ id: cliente.id });
      return { id: row.id };
    },
  };
}
