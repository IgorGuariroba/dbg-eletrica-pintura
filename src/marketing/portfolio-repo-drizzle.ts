import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { fotoPortfolio, membro, ordemServico } from "@/db/schema";
import type {
  AprovarInput,
  FotoPortfolio,
  FotoPortfolioPendente,
  FotoPublica,
  MarcarFotoInput,
  PortfolioRepo,
  RejeitarInput,
} from "./portfolio-repo";

const COLUNAS = {
  id: fotoPortfolio.id,
  osId: fotoPortfolio.osId,
  tecnicoId: fotoPortfolio.tecnicoId,
  categoria: fotoPortfolio.categoria,
  tipo: fotoPortfolio.tipo,
  chavePrivada: fotoPortfolio.chavePrivada,
  chavePublica: fotoPortfolio.chavePublica,
  status: fotoPortfolio.status,
  motivoRejeicao: fotoPortfolio.motivoRejeicao,
  temDadoSensivel: fotoPortfolio.temDadoSensivel,
  criadoEm: fotoPortfolio.criadoEm,
};

export function criarPortfolioRepoDrizzle(db: DB): PortfolioRepo {
  return {
    async marcar(input: MarcarFotoInput): Promise<FotoPortfolio> {
      // Idempotente: a mesma foto (chave R2) só entra na fila uma vez.
      const [row] = await db
        .insert(fotoPortfolio)
        .values({
          osId: input.osId,
          tecnicoId: input.tecnicoId,
          categoria: input.categoria,
          tipo: input.tipo,
          chavePrivada: input.chavePrivada,
        })
        .onConflictDoUpdate({
          target: fotoPortfolio.chavePrivada,
          set: { chavePrivada: input.chavePrivada },
        })
        .returning(COLUNAS);
      return row;
    },

    async buscar(id): Promise<FotoPortfolio | null> {
      const [row] = await db
        .select(COLUNAS)
        .from(fotoPortfolio)
        .where(eq(fotoPortfolio.id, id))
        .limit(1);
      return row ?? null;
    },

    async listarPendentes(): Promise<FotoPortfolioPendente[]> {
      const rows = await db
        .select({
          id: fotoPortfolio.id,
          osId: fotoPortfolio.osId,
          chavePrivada: fotoPortfolio.chavePrivada,
          categoria: fotoPortfolio.categoria,
          tipo: fotoPortfolio.tipo,
          tecnicoNome: membro.nome,
          notaServico: sql<
            string | null
          >`${ordemServico.metadados}->>'notaServico'`,
          criadoEm: fotoPortfolio.criadoEm,
        })
        .from(fotoPortfolio)
        .leftJoin(membro, eq(fotoPortfolio.tecnicoId, membro.id))
        .leftJoin(ordemServico, eq(fotoPortfolio.osId, ordemServico.id))
        .where(eq(fotoPortfolio.status, "PENDENTE"))
        .orderBy(fotoPortfolio.criadoEm);
      return rows;
    },

    async aprovar(id, input: AprovarInput): Promise<boolean> {
      const res = await db
        .update(fotoPortfolio)
        .set({
          status: "APROVADA",
          chavePublica: input.chavePublica,
          temDadoSensivel: input.temDadoSensivel,
          decididoPor: input.decididoPor,
          decididoEm: new Date(),
          motivoRejeicao: null,
        })
        .where(
          and(
            eq(fotoPortfolio.id, id),
            eq(fotoPortfolio.status, "PENDENTE"),
          ),
        )
        .returning({ id: fotoPortfolio.id });
      return res.length > 0;
    },

    async rejeitar(id, input: RejeitarInput): Promise<boolean> {
      const res = await db
        .update(fotoPortfolio)
        .set({
          status: "REJEITADA",
          motivoRejeicao: input.motivo,
          decididoPor: input.decididoPor,
          decididoEm: new Date(),
        })
        .where(
          and(
            eq(fotoPortfolio.id, id),
            eq(fotoPortfolio.status, "PENDENTE"),
          ),
        )
        .returning({ id: fotoPortfolio.id });
      return res.length > 0;
    },

    async listarPublicas(limite): Promise<FotoPublica[]> {
      return publicas(db, eq(fotoPortfolio.status, "APROVADA"), limite);
    },

    async listarPublicasPorTecnico(tecnicoId, limite): Promise<FotoPublica[]> {
      return publicas(
        db,
        and(
          eq(fotoPortfolio.status, "APROVADA"),
          eq(fotoPortfolio.tecnicoId, tecnicoId),
        ),
        limite,
      );
    },
  };
}

async function publicas(
  db: DB,
  where: ReturnType<typeof and> | ReturnType<typeof eq>,
  limite: number,
): Promise<FotoPublica[]> {
  const rows = await db
    .select({
      id: fotoPortfolio.id,
      chavePublica: fotoPortfolio.chavePublica,
      categoria: fotoPortfolio.categoria,
      tipo: fotoPortfolio.tipo,
      tecnicoNome: membro.nome,
      criadoEm: fotoPortfolio.criadoEm,
    })
    .from(fotoPortfolio)
    .leftJoin(membro, eq(fotoPortfolio.tecnicoId, membro.id))
    // Guarda extra: aprovada precisa ter chave pública.
    .where(and(where, isNotNull(fotoPortfolio.chavePublica)))
    .orderBy(desc(fotoPortfolio.criadoEm))
    .limit(limite);
  return rows.map((r) => ({ ...r, chavePublica: r.chavePublica as string }));
}
