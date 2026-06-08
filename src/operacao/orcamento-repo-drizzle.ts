import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  assinatura,
  cliente,
  orcamento,
  orcamentoItem,
  ordemServico,
  plano,
  servico,
  solicitacao,
} from "@/db/schema";
import type {
  NovoOrcamento,
  OrcamentoRepo,
  OsParaOrcamento,
  ServicoPreco,
} from "./orcamento-repo";

export function criarOrcamentoRepoDrizzle(db: DB): OrcamentoRepo {
  return {
    async carregarOsParaOrcamento(osId): Promise<OsParaOrcamento | null> {
      const [os] = await db
        .select({
          id: ordemServico.id,
          estado: ordemServico.estado,
          tecnicoId: ordemServico.tecnicoId,
          categoria: ordemServico.categoria,
        })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      return os ?? null;
    },

    async buscarPrecosServicos(ids): Promise<ServicoPreco[]> {
      if (ids.length === 0) return [];
      const linhas = await db
        .select({
          id: servico.id,
          categoria: servico.categoria,
          precoBase: servico.precoBase,
          ativo: servico.ativo,
        })
        .from(servico)
        .where(inArray(servico.id, ids));
      return linhas;
    },

    async buscarPercentualDescontoAssinante(osId): Promise<string> {
      // OS → solicitação → cliente → assinatura ATIVA → plano. Só assinatura
      // ATIVA conta; PENDENTE/PAUSADA/CANCELADA/INADIMPLENTE não descontam.
      const [row] = await db
        .select({ percentual: plano.percentualDesconto })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .innerJoin(
          assinatura,
          and(
            eq(assinatura.clienteId, cliente.id),
            eq(assinatura.status, "ATIVA"),
          ),
        )
        .innerJoin(plano, eq(assinatura.planoId, plano.id))
        .where(eq(ordemServico.id, osId))
        .limit(1);
      return row?.percentual ?? "0";
    },

    async criarParaOs(dados: NovoOrcamento): Promise<{ id: string } | null> {
      // Neon HTTP não tem transação multi-statement. Insere primeiro, depois
      // tenta o UPDATE-portão atômico (só passa se OS ainda NOVA e do técnico).
      // Se o portão não pega (corrida/estado/dono), compensa apagando o
      // orçamento — o cascade remove os itens.
      const [orc] = await db
        .insert(orcamento)
        .values({
          osId: dados.osId,
          tokenAprovacao: randomBytes(32).toString("hex"),
          totalMaterial: "0",
          totalMaoDeObra: dados.totalMaoDeObra,
          totalDeslocamento: dados.totalDeslocamento,
          descontoPlano: dados.descontoPlano ?? "0",
          percentualDescontoPlano: dados.percentualDescontoPlano ?? "0",
          total: dados.total,
          validoAte: dados.validoAte,
        })
        .returning({ id: orcamento.id });

      try {
        if (dados.itens.length > 0) {
          await db.insert(orcamentoItem).values(
            dados.itens.map((i) => ({
              orcamentoId: orc.id,
              servicoId: i.servicoId,
              quantidade: i.quantidade,
              precoUnitario: i.precoUnitario,
              subtotal: i.subtotal,
            })),
          );
        }
      } catch (e) {
        // Sem transação no Neon HTTP: se os itens falham, remove o orçamento
        // recém-criado para não deixar registro órfão (sem itens) na OS.
        await db.delete(orcamento).where(eq(orcamento.id, orc.id));
        throw e;
      }

      const transitadas = await db
        .update(ordemServico)
        .set({ estado: "ORCADA" })
        .where(
          and(
            eq(ordemServico.id, dados.osId),
            eq(ordemServico.estado, "NOVA"),
            eq(ordemServico.tecnicoId, dados.tecnicoId),
          ),
        )
        .returning({ id: ordemServico.id });

      if (transitadas.length === 0) {
        await db.delete(orcamento).where(eq(orcamento.id, orc.id));
        return null;
      }
      return { id: orc.id };
    },
  };
}
