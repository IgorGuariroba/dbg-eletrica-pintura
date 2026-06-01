import type { DB } from "@/db/client";
import { pagamento } from "@/db/schema";
import type { PagamentoRepo } from "./pagamento-repo";

export function criarPagamentoRepoDrizzle(db: DB): PagamentoRepo {
  return {
    async registrar(p) {
      // Idempotência pela PK composta (payment_id, os_id): a primeira gravação
      // vence; webhook duplicado não insere. `returning` vazio = já existia.
      const inseridas = await db
        .insert(pagamento)
        .values({
          paymentId: p.paymentId,
          osId: p.osId,
          valor: p.valor,
          metodo: p.metodo,
          status: p.status,
          observacao: p.observacao,
        })
        .onConflictDoNothing()
        .returning({ paymentId: pagamento.paymentId });
      return inseridas.length > 0;
    },
  };
}
