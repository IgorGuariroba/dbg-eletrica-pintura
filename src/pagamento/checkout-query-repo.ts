import type { OrdemCheckout } from "./checkout";

export interface SolicitacaoCheckoutView {
  token: string;
  clienteId: string;
  clienteNome: string;
  cidade: string | null;
  uf: string | null;
  criadoEm: Date;
  ordens: OrdemCheckout[];
  saldoCredito: string;
}

export interface PagamentoCheckoutRepo {
  /**
   * Carrega a solicitação pública por token para checkout de pagamento.
   * Retorna apenas as ordens de serviço nos estados CONCLUIDA ou PAGA.
   * Se o token não for encontrado, retorna null.
   */
  carregarPorToken(token: string): Promise<SolicitacaoCheckoutView | null>;
}

// ============================================================
// Implementação Drizzle (inlinada — auditoria #165: seam hipotético,
// um adapter só; regra e query juntas no módulo de domínio)
// ============================================================

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  cliente,
  orcamento,
  ordemServico,
  solicitacao,
} from "@/db/schema";
import { ESTADOS_ENTREGUES } from "@/operacao/estado-predicados";

export function criarPagamentoCheckoutRepoDrizzle(db: DB): PagamentoCheckoutRepo {
  return {
    async carregarPorToken(token: string): Promise<SolicitacaoCheckoutView | null> {
      // 1. Carregar solicitação e dados do cliente
      const [sol] = await db
        .select({
          id: solicitacao.id,
          token: solicitacao.token,
          criadoEm: solicitacao.criadoEm,
          endereco: solicitacao.endereco,
          clienteNome: cliente.nome,
          clienteId: cliente.id,
          saldoCredito: cliente.saldoCredito,
        })
        .from(solicitacao)
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(eq(solicitacao.token, token))
        .limit(1);

      if (!sol) {
        return null;
      }

      // 2. Carregar ordens de serviço nos estados CONCLUIDA ou PAGA
      const ordens = await db
        .select({
          id: ordemServico.id,
          categoria: ordemServico.categoria,
          estado: ordemServico.estado,
        })
        .from(ordemServico)
        .where(
          and(
            eq(ordemServico.solicitacaoId, sol.id),
            inArray(ordemServico.estado, ESTADOS_ENTREGUES)
          )
        );

      if (ordens.length === 0) {
        return {
          token: sol.token,
          clienteId: sol.clienteId,
          clienteNome: sol.clienteNome,
          cidade: sol.endereco?.cidade ?? null,
          uf: sol.endereco?.uf ?? null,
          criadoEm: sol.criadoEm,
          ordens: [],
          saldoCredito: sol.saldoCredito,
        };
      }

      const osIds = ordens.map((o) => o.id);

      // 3. Para cada OS, carregar o orçamento aprovado mais recente
      const orcamentosAprovados = await db
        .select({
          osId: orcamento.osId,
          total: orcamento.total,
          criadoEm: orcamento.criadoEm,
        })
        .from(orcamento)
        .where(
          and(
            inArray(orcamento.osId, osIds),
            isNotNull(orcamento.aprovadoEm)
          )
        )
        .orderBy(desc(orcamento.criadoEm));

      // Mapear orçamento mais recente por OS
      const orcPorOs = new Map<string, string>();
      for (const o of orcamentosAprovados) {
        if (!orcPorOs.has(o.osId)) {
          orcPorOs.set(o.osId, o.total);
        }
      }

      // Uma OS sem orçamento aprovado não tem valor a cobrar — não pode entrar
      // no checkout (evita oferecer pagamento de R$ 0,00). É anomalia de dados:
      // CONCLUIDA/PAGA só se alcança após um orçamento aprovado.
      const ordensMapped: OrdemCheckout[] = ordens.flatMap((o) => {
        const total = orcPorOs.get(o.id);
        if (total === undefined) return [];
        return [
          {
            osId: o.id,
            categoria: o.categoria,
            estado: o.estado,
            total,
            pago: o.estado === "PAGA",
          },
        ];
      });

      return {
        token: sol.token,
        clienteId: sol.clienteId,
        clienteNome: sol.clienteNome,
        cidade: sol.endereco?.cidade ?? null,
        uf: sol.endereco?.uf ?? null,
        criadoEm: sol.criadoEm,
        ordens: ordensMapped,
        saldoCredito: sol.saldoCredito,
      };
    },
  };
}
