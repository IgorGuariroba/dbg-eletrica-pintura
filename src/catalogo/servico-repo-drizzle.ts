import { and, asc, count, eq, not, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { servico } from "@/db/schema";
import { gerarSlugUnico } from "@/equipe/slug";
import type {
  AtualizacaoServico,
  ListarFiltro,
  ListarResultado,
  NovoServico,
  Servico,
  ServicoRepo,
} from "./servico-repo";

function row(r: typeof servico.$inferSelect): Servico {
  return {
    id: r.id,
    nome: r.nome,
    slug: r.slug,
    categoria: r.categoria,
    precoBase: r.precoBase,
    unidade: r.unidade,
    prazoGarantiaMeses: r.prazoGarantiaMeses,
    fotoUrl: r.fotoUrl,
    ativo: r.ativo,
    criadoEm: r.criadoEm,
  };
}

export function criarServicoRepoDrizzle(db: DB): ServicoRepo {
  /** Gera slug kebab-case único, ignorando o próprio registro em updates. */
  function slugUnico(nome: string, ignorarId?: string) {
    return gerarSlugUnico(nome, async (s) => {
      const cond = ignorarId
        ? and(eq(servico.slug, s), not(eq(servico.id, ignorarId)))
        : eq(servico.slug, s);
      const [exists] = await db
        .select({ id: servico.id })
        .from(servico)
        .where(cond)
        .limit(1);
      return Boolean(exists);
    });
  }

  return {
    async inserir(n: NovoServico) {
      const slug = await slugUnico(n.nome);
      const [r] = await db
        .insert(servico)
        .values({ ...n, slug })
        .returning();
      return row(r);
    },
    async atualizar(id, mudancas: AtualizacaoServico) {
      if (Object.keys(mudancas).length === 0) {
        const [r] = await db.select().from(servico).where(eq(servico.id, id));
        return r ? row(r) : null;
      }
      const finalMudancas: AtualizacaoServico & { slug?: string } = {
        ...mudancas,
      };
      if (mudancas.nome) {
        finalMudancas.slug = await slugUnico(mudancas.nome, id);
      }
      const [r] = await db
        .update(servico)
        .set(finalMudancas)
        .where(eq(servico.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async toggleAtivo(id) {
      const [r] = await db
        .update(servico)
        .set({ ativo: not(servico.ativo) })
        .where(eq(servico.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async buscarPorId(id) {
      const [r] = await db.select().from(servico).where(eq(servico.id, id));
      return r ? row(r) : null;
    },
    async buscarPorSlug(slug) {
      const [r] = await db
        .select()
        .from(servico)
        .where(eq(servico.slug, slug));
      return r ? row(r) : null;
    },
    async listar({ categoria, ativo, limit, offset }: ListarFiltro): Promise<ListarResultado> {
      const conds = [];
      if (categoria) conds.push(eq(servico.categoria, categoria));
      if (typeof ativo === "boolean") conds.push(eq(servico.ativo, ativo));
      const where = conds.length ? and(...conds) : undefined;

      const [itens, totals] = await Promise.all([
        db
          .select()
          .from(servico)
          .where(where)
          .orderBy(asc(servico.nome))
          .limit(limit)
          .offset(offset),
        db
          .select({ value: count() })
          .from(servico)
          .where(where ?? sql`true`),
      ]);

      return { itens: itens.map(row), total: Number(totals[0].value) };
    },
  };
}
