import { and, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type { StatusAssinatura } from "./assinatura-repo";

export interface PlanoOpcao {
  id: string;
  nome: string;
  preco: string;
}

export interface GestaoAssinatura {
  id: string;
  preapprovalIdMp: string;
  status: StatusAssinatura;
  plano: PlanoOpcao;
  /** Nome do plano de um downgrade agendado, se houver. */
  planoPendenteNome: string | null;
  cancelamentoPendente: boolean;
  fimCicloAtual: Date | null;
  /** Planos ativos mais caros (alvos de upgrade). */
  opcoesUpgrade: PlanoOpcao[];
  /** Planos ativos mais baratos (alvos de downgrade). */
  opcoesDowngrade: PlanoOpcao[];
}

/** Estados em que ainda faz sentido oferecer ações de gestão ao cliente. */
const GERENCIAVEIS: StatusAssinatura[] = [
  "ATIVA",
  "PENDENTE",
  "PAUSADA",
  "INADIMPLENTE",
];

/**
 * Carrega a assinatura gerenciável mais recente do cliente (pelo WhatsApp) com
 * os planos candidatos a upgrade/downgrade já separados por preço. Devolve
 * `null` quando o cliente não tem assinatura gerenciável.
 */
export async function carregarGestaoAssinatura(
  whatsapp: string,
  db: DB,
): Promise<GestaoAssinatura | null> {
  const [row] = await db
    .select({
      id: assinatura.id,
      preapprovalIdMp: assinatura.preapprovalIdMp,
      status: assinatura.status,
      cancelamentoPendente: assinatura.cancelamentoPendente,
      fimCicloAtual: assinatura.fimCicloAtual,
      planoPendenteId: assinatura.planoPendenteId,
      planoId: plano.id,
      planoNome: plano.nome,
      planoPreco: plano.preco,
    })
    .from(assinatura)
    .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
    .innerJoin(plano, eq(assinatura.planoId, plano.id))
    .where(
      and(
        eq(cliente.whatsapp, whatsapp),
        inArray(assinatura.status, GERENCIAVEIS),
      ),
    )
    .orderBy(desc(assinatura.criadoEm))
    .limit(1);

  if (!row || !row.preapprovalIdMp) return null;

  // Catálogo completo p/ resolver o nome do plano pendente (pode estar inativo)
  // e separar as opções de up/downgrade (somente ativos).
  const todos = await db
    .select({
      id: plano.id,
      nome: plano.nome,
      preco: plano.preco,
      ativo: plano.ativo,
    })
    .from(plano);

  const precoAtual = Number(row.planoPreco);
  const ativos = todos.filter((p) => p.ativo && p.id !== row.planoId);
  const opcoesUpgrade = ativos
    .filter((p) => Number(p.preco) > precoAtual)
    .map(({ id, nome, preco }) => ({ id, nome, preco }));
  const opcoesDowngrade = ativos
    .filter((p) => Number(p.preco) < precoAtual)
    .map(({ id, nome, preco }) => ({ id, nome, preco }));

  return {
    id: row.id,
    preapprovalIdMp: row.preapprovalIdMp,
    status: row.status,
    plano: { id: row.planoId, nome: row.planoNome, preco: row.planoPreco },
    planoPendenteNome:
      todos.find((p) => p.id === row.planoPendenteId)?.nome ?? null,
    cancelamentoPendente: row.cancelamentoPendente,
    fimCicloAtual: row.fimCicloAtual,
    opcoesUpgrade,
    opcoesDowngrade,
  };
}
