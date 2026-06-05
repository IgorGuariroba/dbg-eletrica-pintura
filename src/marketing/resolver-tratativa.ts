import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { alertaAvaliacao } from "@/db/schema";

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
 * ao cliente (WhatsApp + e-mail).
 *
 * Idempotência ancorada no **status do alerta**, não num marco permanente: a
 * transição PENDENTE → RESOLVIDO é feita por um UPDATE condicional que só casa
 * uma vez por ciclo. Reexecutar (duplo clique) vê o alerta já RESOLVIDO e é
 * no-op. Quando uma reavaliação negativa reabre o alerta para PENDENTE, um novo
 * resolve volta a disparar — cada rodada de tratativa convida uma vez.
 *
 * Se o envio falhar, o status é revertido para PENDENTE para permitir nova
 * tentativa (não fica "resolvido sem nunca ter notificado").
 */
export async function resolverTratativa(
  alertaAvaliacaoId: string,
  deps: ResolverTratativaDeps,
): Promise<void> {
  const { db } = deps;

  // 1. Garante que o alerta existe (contrato de erro distinto de "já resolvido").
  const [alerta] = await db
    .select({ id: alertaAvaliacao.id })
    .from(alertaAvaliacao)
    .where(eq(alertaAvaliacao.id, alertaAvaliacaoId))
    .limit(1);

  if (!alerta) {
    throw new Error(`Alerta de avaliação não encontrado: ${alertaAvaliacaoId}`);
  }

  // 2. Reivindica a resolução: só transiciona se ainda PENDENTE. O returning
  //    devolve o osId apenas quando esta chamada ganhou a corrida.
  const agora = new Date();
  const reivindicado = await db
    .update(alertaAvaliacao)
    .set({ status: "RESOLVIDO", resolvidoEm: agora, atualizadoEm: agora })
    .where(
      and(
        eq(alertaAvaliacao.id, alertaAvaliacaoId),
        eq(alertaAvaliacao.status, "PENDENTE"),
      ),
    )
    .returning({ osId: alertaAvaliacao.osId });

  // 3. Já resolvido (duplo clique / ciclo anterior) → não reenvia.
  if (reivindicado.length === 0) return;

  // 4. Dispara o convite; se falhar, reverte para PENDENTE para retry.
  if (deps.enviarReavaliacao) {
    try {
      await deps.enviarReavaliacao(reivindicado[0].osId);
    } catch (e) {
      await db
        .update(alertaAvaliacao)
        .set({ status: "PENDENTE", resolvidoEm: null, atualizadoEm: new Date() })
        .where(eq(alertaAvaliacao.id, alertaAvaliacaoId));
      throw e;
    }
  }
}
