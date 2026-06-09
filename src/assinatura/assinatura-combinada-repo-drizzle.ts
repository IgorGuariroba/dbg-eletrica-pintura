import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura } from "@/db/schema";
import type { AssinaturaCombinadaRepo } from "./assinatura-combinada";

export function criarAssinaturaCombinadaRepoDrizzle(
  db: DB,
): AssinaturaCombinadaRepo {
  return {
    async criarPendente(dados) {
      const [row] = await db
        .insert(assinatura)
        .values({
          clienteId: dados.clienteId,
          planoId: dados.planoId,
          status: "PENDENTE",
        })
        .returning({ id: assinatura.id });
      return { id: row.id };
    },

    async ativarSePendente(assinaturaId, dados) {
      // O filtro por status na própria UPDATE torna a ativação idempotente
      // sob webhooks concorrentes: só a 1ª transição PENDENTE→ATIVA afeta linha.
      const rows = await db
        .update(assinatura)
        .set({
          status: "ATIVA",
          inicio: dados.inicio,
          fimCicloAtual: dados.fimCicloAtual,
        })
        .where(
          and(
            eq(assinatura.id, assinaturaId),
            eq(assinatura.status, "PENDENTE"),
          ),
        )
        .returning({ id: assinatura.id });
      if (rows.length > 0) return "ativada";

      const [existe] = await db
        .select({ id: assinatura.id })
        .from(assinatura)
        .where(eq(assinatura.id, assinaturaId))
        .limit(1);
      return existe ? "nao_pendente" : "nao_encontrada";
    },
  };
}
