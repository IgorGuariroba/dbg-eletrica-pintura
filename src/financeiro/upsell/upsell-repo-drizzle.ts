import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type { UpsellRepo } from "./upsell-repo";

export function criarUpsellRepoDrizzle(db: DB): UpsellRepo {
  return {
    async temAssinaturaAtiva(clienteId) {
      const [row] = await db
        .select({ id: assinatura.id })
        .from(assinatura)
        .where(
          and(
            eq(assinatura.clienteId, clienteId),
            eq(assinatura.status, "ATIVA"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async upsellVistoEm(clienteId) {
      const [row] = await db
        .select({ vistoEm: cliente.upsellVistoEm })
        .from(cliente)
        .where(eq(cliente.id, clienteId))
        .limit(1);
      return row?.vistoEm ?? null;
    },

    async marcarUpsellVisto(clienteId, quando) {
      await db
        .update(cliente)
        .set({ upsellVistoEm: quando })
        .where(eq(cliente.id, clienteId));
    },

    async planoDestaque() {
      const [row] = await db
        .select({
          id: plano.id,
          nome: plano.nome,
          slug: plano.slug,
          preco: plano.preco,
          percentualDesconto: plano.percentualDesconto,
        })
        .from(plano)
        .where(and(eq(plano.ativo, true), isNotNull(plano.slug)))
        .orderBy(desc(plano.percentualDesconto))
        .limit(1);
      if (!row || !row.slug) return null;
      return { ...row, slug: row.slug };
    },

    async contarAssinaturasAtivas() {
      const [row] = await db
        .select({ total: count() })
        .from(assinatura)
        .where(eq(assinatura.status, "ATIVA"));
      return row?.total ?? 0;
    },
  };
}
