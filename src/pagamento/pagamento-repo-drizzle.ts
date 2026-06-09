import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { pagamento, cliente, solicitacao, ordemServico, indicacao, configReferral, creditoMovimentacao } from "@/db/schema";
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

    async processarReferralPosPagamento(osId) {
      // 1. Obtém o cliente dono da OS
      const [os] = await db
        .select({ solicitacaoId: ordemServico.solicitacaoId })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      if (!os) return;

      const [sol] = await db
        .select({ clienteId: solicitacao.clienteId })
        .from(solicitacao)
        .where(eq(solicitacao.id, os.solicitacaoId))
        .limit(1);
      if (!sol) return;

      const clienteId = sol.clienteId;

      // 2. Verifica se o cliente tem uma indicação registrada e creditoGerado = false
      const [ind] = await db
        .select()
        .from(indicacao)
        .where(and(eq(indicacao.indicadoId, clienteId), eq(indicacao.creditoGerado, false)))
        .limit(1);
      if (!ind) return;

      // 3. Verifica se esta OS é a primeira OS paga ou concluída do cliente (exclui preventivas/garantias que não têm custo)
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .where(
          and(
            eq(solicitacao.clienteId, clienteId),
            inArray(ordemServico.estado, ["PAGA", "CONCLUIDA"]),
            inArray(ordemServico.tipo, ["NORMAL", "EXPRESS", "COMPLEMENTAR"])
          )
        );

      if (count !== 1) {
        return;
      }

      // 4. Carrega o valor do prêmio de indicação configurado
      const [config] = await db
        .select({ valorPremio: configReferral.valorPremio, ativo: configReferral.ativo })
        .from(configReferral)
        .where(eq(configReferral.id, "default"))
        .limit(1);
      
      const ativo = config?.ativo ?? true;
      const premio = ativo ? (config?.valorPremio ?? "30.00") : "0.00";

      if (Number(premio) <= 0) return;

      // 5. Adiciona o prêmio ao saldo de crédito do indicador e marca a indicação como creditoGerado = true
      const [padrinho] = await db
        .select({ saldoCredito: cliente.saldoCredito })
        .from(cliente)
        .where(eq(cliente.id, ind.indicadorId))
        .limit(1);
      if (padrinho) {
        const novoSaldo = (Number(padrinho.saldoCredito) + Number(premio)).toFixed(2);
        await db.batch([
          db
            .update(indicacao)
            .set({ creditoGerado: true })
            .where(eq(indicacao.id, ind.id)),
          db
            .update(cliente)
            .set({ saldoCredito: novoSaldo })
            .where(eq(cliente.id, ind.indicadorId))
        ]);
      }
    },

    async consumirCredito(paymentId, clienteId, valor) {
      if (Number(valor) <= 0) return;

      // 1. Verifica se já existe uma movimentação para este paymentId (idempotência)
      const [existente] = await db
        .select()
        .from(creditoMovimentacao)
        .where(eq(creditoMovimentacao.paymentId, paymentId))
        .limit(1);
      if (existente) return;

      // 2. Busca o cliente para obter seu saldo de crédito
      const [cli] = await db
        .select({ saldoCredito: cliente.saldoCredito })
        .from(cliente)
        .where(eq(cliente.id, clienteId))
        .limit(1);
      if (!cli) return;

      const novoSaldo = Math.max(0, Number(cli.saldoCredito) - Number(valor)).toFixed(2);

      // 3. Insere a movimentação e deduz do cliente em um lote atômico (db.batch)
      await db.batch([
        db.insert(creditoMovimentacao).values({
          clienteId,
          valor,
          tipo: "CONSUMIDO",
          paymentId,
        }),
        db
          .update(cliente)
          .set({ saldoCredito: novoSaldo })
          .where(eq(cliente.id, clienteId)),
      ]);
    }
  };
}
