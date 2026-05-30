import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { cliente, ordemServico, solicitacao } from "@/db/schema";
import type {
  FilaRepo,
  ListarFilaFiltro,
  ListarFilaResultado,
  OsFila,
} from "./fila-repo";

type Endereco = NonNullable<typeof solicitacao.$inferSelect.endereco>;

function osFila(row: {
  os: typeof ordemServico.$inferSelect;
  clienteNome: string;
  endereco: Endereco;
}): OsFila {
  return {
    id: row.os.id,
    categoria: row.os.categoria,
    tipo: row.os.tipo,
    estado: row.os.estado,
    tecnicoId: row.os.tecnicoId,
    clienteNome: row.clienteNome,
    cidade: row.endereco.cidade,
    uf: row.endereco.uf,
    criadoEm: row.os.criadoEm,
  };
}

export function criarFilaRepoDrizzle(db: DB): FilaRepo {
  const baseSelect = () =>
    db
      .select({
        os: ordemServico,
        clienteNome: cliente.nome,
        endereco: solicitacao.endereco,
      })
      .from(ordemServico)
      .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
      .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id));

  return {
    async listar(filtro: ListarFilaFiltro): Promise<ListarFilaResultado> {
      const conds = [];
      if (filtro.apenasDisponiveis) {
        conds.push(eq(ordemServico.estado, "NOVA"));
        if (filtro.incluirTecnicoId) {
          conds.push(
            or(
              isNull(ordemServico.tecnicoId),
              eq(ordemServico.tecnicoId, filtro.incluirTecnicoId),
            ),
          );
        } else {
          conds.push(isNull(ordemServico.tecnicoId));
        }
      }
      if (filtro.categorias) {
        // Técnico sem especialidade não enxerga nada.
        if (filtro.categorias.length === 0) return { itens: [], total: 0 };
        conds.push(inArray(ordemServico.categoria, filtro.categorias));
      }
      const where = conds.length ? and(...conds) : undefined;

      const linhas = await baseSelect()
        .where(where)
        .orderBy(asc(ordemServico.criadoEm))
        .limit(filtro.limit)
        .offset(filtro.offset);

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ordemServico)
        .where(where);

      return {
        itens: linhas.map((l) =>
          osFila({ os: l.os, clienteNome: l.clienteNome, endereco: l.endereco! }),
        ),
        total,
      };
    },

    async listarPorTecnico(tecnicoId: string): Promise<OsFila[]> {
      const linhas = await baseSelect()
        .where(eq(ordemServico.tecnicoId, tecnicoId))
        .orderBy(asc(ordemServico.criadoEm));
      return linhas.map((l) =>
        osFila({ os: l.os, clienteNome: l.clienteNome, endereco: l.endereco! }),
      );
    },

    async buscarPorId(id: string): Promise<OsFila | null> {
      const [l] = await baseSelect().where(eq(ordemServico.id, id)).limit(1);
      if (!l) return null;
      return osFila({
        os: l.os,
        clienteNome: l.clienteNome,
        endereco: l.endereco!,
      });
    },

    async autoatribuir(osId, tecnicoId): Promise<OsFila | null> {
      // UPDATE atômico: só vence quem encontra a OS ainda NOVA e sem dono.
      const atualizadas = await db
        .update(ordemServico)
        .set({ tecnicoId })
        .where(
          and(
            eq(ordemServico.id, osId),
            eq(ordemServico.estado, "NOVA"),
            isNull(ordemServico.tecnicoId),
          ),
        )
        .returning({ id: ordemServico.id });
      if (atualizadas.length === 0) return null;
      return this.buscarPorId(osId);
    },

    async devolver(osId, tecnicoId, motivo): Promise<OsFila | null> {
      const entrada = JSON.stringify([
        { tecnicoId, motivo, em: new Date().toISOString() },
      ]);
      const atualizadas = await db
        .update(ordemServico)
        .set({
          tecnicoId: null,
          metadados: sql`jsonb_set(
            coalesce(${ordemServico.metadados}, '{}'::jsonb),
            '{devolucoes}',
            coalesce(${ordemServico.metadados} -> 'devolucoes', '[]'::jsonb) || ${entrada}::jsonb
          )`,
        })
        .where(
          and(
            eq(ordemServico.id, osId),
            eq(ordemServico.estado, "NOVA"),
            eq(ordemServico.tecnicoId, tecnicoId),
          ),
        )
        .returning({ id: ordemServico.id });
      if (atualizadas.length === 0) return null;
      return this.buscarPorId(osId);
    },
  };
}
