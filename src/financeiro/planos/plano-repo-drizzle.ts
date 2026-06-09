import { and, asc, eq, not } from "drizzle-orm";
import type { DB } from "@/db/client";
import { plano } from "@/db/schema";
import { gerarSlugUnico } from "@/equipe/slug";
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
    slug: r.slug,
    preco: r.preco,
    beneficios: r.beneficios,
    percentualDesconto: r.percentualDesconto,
    preventivasPorAno: r.preventivasPorAno,
    categoriasPreventiva: r.categoriasPreventiva,
    prioridadeAgendamento: r.prioridadeAgendamento,
    ativo: r.ativo,
    preapprovalPlanIdMp: r.preapprovalPlanIdMp,
    criadoEm: r.criadoEm,
  };
}

export function criarPlanoRepoDrizzle(db: DB): PlanoRepo {
  return {
    async inserir(n: NovoPlano) {
      const slug = await gerarSlugUnico(n.nome, async (s) => {
        const [exists] = await db
          .select({ id: plano.id })
          .from(plano)
          .where(eq(plano.slug, s))
          .limit(1);
        return Boolean(exists);
      });
      const [r] = await db
        .insert(plano)
        .values({ ...n, slug })
        .returning();
      return row(r);
    },
    async atualizar(id, mudancas: AtualizacaoPlano) {
      if (Object.keys(mudancas).length === 0) {
        const [r] = await db.select().from(plano).where(eq(plano.id, id));
        return r ? row(r) : null;
      }
      const valores: AtualizacaoPlano & { slug?: string } = { ...mudancas };
      // Renomear o plano recalcula o slug (mantém a landing /assinar/{slug}
      // coerente com o nome), ignorando o próprio registro na checagem de unicidade.
      if (mudancas.nome) {
        valores.slug = await gerarSlugUnico(mudancas.nome, async (s) => {
          const [exists] = await db
            .select({ id: plano.id })
            .from(plano)
            .where(and(eq(plano.slug, s), not(eq(plano.id, id))))
            .limit(1);
          return Boolean(exists);
        });
      }
      const [r] = await db
        .update(plano)
        .set(valores)
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
    async buscarPorSlug(slug) {
      const [r] = await db.select().from(plano).where(eq(plano.slug, slug));
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
