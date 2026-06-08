import { asc, eq, not } from "drizzle-orm";
import type { DB } from "@/db/client";
import { plano } from "@/db/schema";
import type {
  AtualizacaoPlano,
  NovoPlano,
  Plano,
  PlanoRepo,
} from "./plano-repo";

function row(r: typeof plano.$inferSelect): Plano {
  return {
    id: r.id,
    nome: r.nome,
    preco: r.preco,
    beneficios: r.beneficios,
    percentualDesconto: r.percentualDesconto,
    preventivasPorAno: r.preventivasPorAno,
    prioridadeAgendamento: r.prioridadeAgendamento,
    ativo: r.ativo,
    preapprovalPlanIdMp: r.preapprovalPlanIdMp,
    criadoEm: r.criadoEm,
  };
}

export function criarPlanoRepoDrizzle(db: DB): PlanoRepo {
  return {
    async inserir(n: NovoPlano) {
      const [r] = await db.insert(plano).values(n).returning();
      return row(r);
    },
    async atualizar(id, mudancas: AtualizacaoPlano) {
      if (Object.keys(mudancas).length === 0) {
        const [r] = await db.select().from(plano).where(eq(plano.id, id));
        return r ? row(r) : null;
      }
      const [r] = await db
        .update(plano)
        .set(mudancas)
        .where(eq(plano.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async toggleAtivo(id) {
      const [r] = await db
        .update(plano)
        .set({ ativo: not(plano.ativo) })
        .where(eq(plano.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async buscarPorId(id) {
      const [r] = await db.select().from(plano).where(eq(plano.id, id));
      return r ? row(r) : null;
    },
    async listarAtivos() {
      const rows = await db
        .select()
        .from(plano)
        .where(eq(plano.ativo, true))
        .orderBy(asc(plano.preco));
      return rows.map(row);
    },
    async listarTodos() {
      const rows = await db.select().from(plano).orderBy(asc(plano.preco));
      return rows.map(row);
    },
    async definirPreapprovalPlanIdMp(id, mpId) {
      await db
        .update(plano)
        .set({ preapprovalPlanIdMp: mpId })
        .where(eq(plano.id, id));
    },
  };
}
