import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { alertaAvaliacao, notificacaoMarco } from "@/db/schema";

export interface ResolverTratativaDeps {
  db: DB;
  /**
   * Função que envia o convite de reavaliação para o cliente via WhatsApp +
   * e-mail. Injetável para isolar testes do banco/WhatsApp. Recebe o osId.
   */
  enviarReavaliacao?: (osId: string) => Promise<void>;
}

/**
 * Marca o alerta de avaliação como RESOLVIDO e dispara o pedido de reavaliação
 * ao cliente (WhatsApp + e-mail) exatamente 1x, usando o marco idempotente
 * "reavaliacao:disparo" em `notificacao_marco`.
 */
export async function resolverTratativa(
  alertaAvaliacaoId: string,
  deps: ResolverTratativaDeps,
): Promise<void> {
  const { db } = deps;

  // 1. Buscar o alerta para obter o osId
  const [alerta] = await db
    .select({ osId: alertaAvaliacao.osId })
    .from(alertaAvaliacao)
    .where(eq(alertaAvaliacao.id, alertaAvaliacaoId))
    .limit(1);

  if (!alerta) {
    throw new Error(`Alerta de avaliação não encontrado: ${alertaAvaliacaoId}`);
  }

  // 2. Marcar alerta como RESOLVIDO
  await db
    .update(alertaAvaliacao)
    .set({ status: "RESOLVIDO", resolvidoEm: new Date(), atualizadoEm: new Date() })
    .where(eq(alertaAvaliacao.id, alertaAvaliacaoId));

  // 3. Reivindica o marco idempotente — onConflictDoNothing garante envio único
  const claim = await db
    .insert(notificacaoMarco)
    .values({ osId: alerta.osId, marco: "reavaliacao:disparo" })
    .onConflictDoNothing({ target: [notificacaoMarco.osId, notificacaoMarco.marco] })
    .returning({ id: notificacaoMarco.id });

  // 4. Só dispara se ganhou a corrida (1ª execução)
  if (claim.length > 0 && deps.enviarReavaliacao) {
    await deps.enviarReavaliacao(alerta.osId);
  }
}
