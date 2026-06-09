import { asc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  landingOverride,
  landingOverrideDepoimento,
  landingOverrideFoto,
} from "@/db/schema";
import type {
  LandingOverride,
  LandingOverrideFoto,
  LandingOverrideRepo,
  SalvarOverrideInput,
} from "./landing-override-repo";

export function criarLandingOverrideRepoDrizzle(db: DB): LandingOverrideRepo {
  async function carregar(servicoId: string): Promise<LandingOverride | null> {
    const [base] = await db
      .select()
      .from(landingOverride)
      .where(eq(landingOverride.servicoId, servicoId));
    if (!base) return null;

    const fotos = await db
      .select()
      .from(landingOverrideFoto)
      .where(eq(landingOverrideFoto.servicoId, servicoId))
      .orderBy(asc(landingOverrideFoto.ordem));

    const depoimentos = await db
      .select()
      .from(landingOverrideDepoimento)
      .where(eq(landingOverrideDepoimento.servicoId, servicoId))
      .orderBy(asc(landingOverrideDepoimento.ordem));

    return {
      servicoId: base.servicoId,
      titulo: base.titulo,
      descricao: base.descricao,
      precoPromo: base.precoPromo,
      upsellServicoId: base.upsellServicoId,
      fotos: fotos.map(
        (f): LandingOverrideFoto => ({
          id: f.id,
          chave: f.chave,
          ordem: f.ordem,
        }),
      ),
      depoimentoIds: depoimentos.map((d) => d.avaliacaoId),
    };
  }

  return {
    obterPorServico: carregar,

    async salvar(servicoId, dados: SalvarOverrideInput) {
      await db
        .insert(landingOverride)
        .values({
          servicoId,
          titulo: dados.titulo ?? null,
          descricao: dados.descricao ?? null,
          precoPromo: dados.precoPromo ?? null,
          upsellServicoId: dados.upsellServicoId ?? null,
        })
        .onConflictDoUpdate({
          target: landingOverride.servicoId,
          set: {
            titulo: dados.titulo ?? null,
            descricao: dados.descricao ?? null,
            precoPromo: dados.precoPromo ?? null,
            upsellServicoId: dados.upsellServicoId ?? null,
            atualizadoEm: new Date(),
          },
        });
      const override = await carregar(servicoId);
      if (!override) throw new Error("Falha ao salvar override");
      return override;
    },

    async adicionarFoto(servicoId, chave) {
      const [{ proxima }] = await db
        .select({
          proxima: sql<number>`coalesce(max(${landingOverrideFoto.ordem}) + 1, 0)`,
        })
        .from(landingOverrideFoto)
        .where(eq(landingOverrideFoto.servicoId, servicoId));
      const [r] = await db
        .insert(landingOverrideFoto)
        .values({ servicoId, chave, ordem: Number(proxima) })
        .returning();
      return { id: r.id, chave: r.chave, ordem: r.ordem };
    },

    async removerFoto(fotoId) {
      await db
        .delete(landingOverrideFoto)
        .where(eq(landingOverrideFoto.id, fotoId));
    },

    async definirDepoimentos(servicoId, avaliacaoIds) {
      await db
        .delete(landingOverrideDepoimento)
        .where(eq(landingOverrideDepoimento.servicoId, servicoId));
      if (avaliacaoIds.length === 0) return;
      await db.insert(landingOverrideDepoimento).values(
        avaliacaoIds.map((avaliacaoId, ordem) => ({
          servicoId,
          avaliacaoId,
          ordem,
        })),
      );
    },
  };
}
