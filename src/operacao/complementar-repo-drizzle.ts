import { randomBytes } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { orcamento, orcamentoItem, ordemServico, servico } from "@/db/schema";
import type {
  ComplementarRepo,
  NovoComplementar,
  OsPai,
} from "./complementar";
import type { ServicoPreco } from "./orcamento-repo";

export function criarComplementarRepoDrizzle(db: DB): ComplementarRepo {
  return {
    async carregarPai(osPaiId): Promise<OsPai | null> {
      const [pai] = await db
        .select({
          id: ordemServico.id,
          estado: ordemServico.estado,
          tecnicoId: ordemServico.tecnicoId,
          categoria: ordemServico.categoria,
          solicitacaoId: ordemServico.solicitacaoId,
        })
        .from(ordemServico)
        .where(eq(ordemServico.id, osPaiId))
        .limit(1);
      return pai ?? null;
    },

    async buscarPrecosServicos(ids): Promise<ServicoPreco[]> {
      if (ids.length === 0) return [];
      return db
        .select({
          id: servico.id,
          categoria: servico.categoria,
          precoBase: servico.precoBase,
          ativo: servico.ativo,
        })
        .from(servico)
        .where(inArray(servico.id, ids));
    },

    async criarComplementarComOrcamento(dados: NovoComplementar) {
      // OS COMPLEMENTAR nasce direto em ORÇADA, vinculada à pai e atribuída ao
      // técnico criador (já está no local — nunca entra na fila pública).
      const [os] = await db
        .insert(ordemServico)
        .values({
          solicitacaoId: dados.solicitacaoId,
          osPaiId: dados.osPaiId,
          tipo: "COMPLEMENTAR",
          estado: "ORCADA",
          categoria: dados.categoria,
          tecnicoId: dados.tecnicoId,
        })
        .returning({ id: ordemServico.id });

      // Neon HTTP não tem transação multi-statement: se algo após o insert da
      // OS falha, compensa apagando a OS recém-criada (cascade leva o resto).
      try {
        const [orc] = await db
          .insert(orcamento)
          .values({
            osId: os.id,
            tokenAprovacao: randomBytes(32).toString("hex"),
            totalMaterial: "0",
            totalMaoDeObra: dados.totalMaoDeObra,
            totalDeslocamento: dados.totalDeslocamento,
            total: dados.total,
            validoAte: dados.validoAte,
          })
          .returning({ id: orcamento.id });

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
        return { osId: os.id, orcamentoId: orc.id };
      } catch (e) {
        await db.delete(ordemServico).where(eq(ordemServico.id, os.id));
        throw e;
      }
    },

    async marcarAguardando(osPaiId, complementarId): Promise<void> {
      // Mescla no jsonb sem sobrescrever metadados existentes (ex: devoluções).
      await db
        .update(ordemServico)
        .set({
          metadados: sql`${ordemServico.metadados} || ${JSON.stringify({
            aguardandoComplementar: true,
            complementarId,
          })}::jsonb`,
        })
        .where(eq(ordemServico.id, osPaiId));
    },

    async listarComplementares(osPaiId) {
      return db
        .select({ id: ordemServico.id, estado: ordemServico.estado })
        .from(ordemServico)
        .where(eq(ordemServico.osPaiId, osPaiId))
        .orderBy(asc(ordemServico.criadoEm));
    },
  };
}
