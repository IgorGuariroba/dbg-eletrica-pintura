import { and, asc, count, eq, not, sql, type SQL } from "drizzle-orm";
import { type DB, ehViolacaoUnica } from "@/db/client";
import { membro } from "@/db/schema";
import type {
  AtualizacaoMembro,
  ListarFiltro,
  ListarResultado,
  Membro,
  MembroRepo,
  NovoMembro,
} from "./membro-repo";
import { EmailDuplicadoError } from "./membro-repo";
import { gerarSlugUnico } from "@/equipe/slug";

async function executarPreservandoEmailUnico<T>(
  fn: () => Promise<T>,
  emailTentado: string | undefined,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (ehViolacaoUnica(e) && emailTentado) {
      throw new EmailDuplicadoError(emailTentado);
    }
    throw e;
  }
}

function row(r: typeof membro.$inferSelect): Membro {
  return {
    id: r.id,
    nome: r.nome,
    email: r.email,
    modulos: r.modulos,
    isTecnico: r.isTecnico,
    fotoUrl: r.fotoUrl,
    bio: r.bio,
    especialidades: r.especialidades,
    disponibilidade: r.disponibilidade ?? null,
    ativo: r.ativo,
    slug: r.slug,
    criadoEm: r.criadoEm,
  };
}

export function criarMembroRepoDrizzle(db: DB): MembroRepo {
  return {
    async inserir(n: NovoMembro) {
      return executarPreservandoEmailUnico(async () => {
        const slug = await gerarSlugUnico(n.nome, async (s) => {
          const [exists] = await db
            .select({ id: membro.id })
            .from(membro)
            .where(eq(membro.slug, s))
            .limit(1);
          return Boolean(exists);
        });

        const [r] = await db.insert(membro).values({ ...n, slug }).returning();
        return row(r);
      }, n.email);
    },
    async atualizar(id, mudancas: AtualizacaoMembro) {
      if (Object.keys(mudancas).length === 0) {
        const [r] = await db.select().from(membro).where(eq(membro.id, id));
        return r ? row(r) : null;
      }
      return executarPreservandoEmailUnico(async () => {
        const finalMudancas = { ...mudancas } as any;

        if (mudancas.nome) {
          const slug = await gerarSlugUnico(mudancas.nome, async (s) => {
            const [exists] = await db
              .select({ id: membro.id })
              .from(membro)
              .where(and(eq(membro.slug, s), not(eq(membro.id, id))))
              .limit(1);
            return Boolean(exists);
          });
          finalMudancas.slug = slug;
        }

        const [r] = await db
          .update(membro)
          .set(finalMudancas)
          .where(eq(membro.id, id))
          .returning();
        return r ? row(r) : null;
      }, mudancas.email);
    },
    async toggleAtivo(id) {
      const [r] = await db
        .update(membro)
        .set({ ativo: not(membro.ativo) })
        .where(eq(membro.id, id))
        .returning();
      return r ? row(r) : null;
    },
    async buscarPorId(id) {
      const [r] = await db.select().from(membro).where(eq(membro.id, id));
      return r ? row(r) : null;
    },
    async buscarPorEmail(email) {
      const [r] = await db
        .select()
        .from(membro)
        .where(eq(membro.email, email.toLowerCase()));
      return r ? row(r) : null;
    },
    async buscarPorSlug(slug) {
      const [r] = await db
        .select()
        .from(membro)
        .where(eq(membro.slug, slug));
      return r ? row(r) : null;
    },
    async listar({ papel, ativo, limit, offset }: ListarFiltro): Promise<ListarResultado> {
      const conds: SQL[] = [];
      const possuiModulo = sql`coalesce(array_length(${membro.modulos}, 1), 0) > 0`;
      if (papel === "tecnico") {
        conds.push(eq(membro.isTecnico, true));
      } else if (papel === "interno") {
        conds.push(possuiModulo);
      } else if (papel === "ambos") {
        conds.push(eq(membro.isTecnico, true), possuiModulo);
      }
      if (typeof ativo === "boolean") conds.push(eq(membro.ativo, ativo));
      const where = conds.length ? and(...conds) : undefined;

      const [itens, totals] = await Promise.all([
        db
          .select()
          .from(membro)
          .where(where)
          .orderBy(asc(membro.nome))
          .limit(limit)
          .offset(offset),
        db
          .select({ value: count() })
          .from(membro)
          .where(where ?? sql`true`),
      ]);

      return { itens: itens.map(row), total: Number(totals[0].value) };
    },
  };
}
