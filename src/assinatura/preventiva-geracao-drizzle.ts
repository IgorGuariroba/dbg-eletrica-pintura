import { randomBytes } from "node:crypto";
import { and, eq, inArray, max } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, cliente, ordemServico, plano, solicitacao } from "@/db/schema";
import type { Categoria } from "@/financeiro/planos/plano-repo";
import type {
  AssinaturaAtiva,
  NovaPreventiva,
  PreventivaGeracaoRepo,
} from "./preventiva-geracao";

/** Estados em que uma preventiva ainda está "em aberto" (trava de idempotência). */
const ESTADOS_ABERTOS = [
  "AGENDADA",
  "A_CAMINHO",
  "NO_LOCAL",
  "EM_EXECUCAO",
] as const;

export function criarPreventivaGeracaoRepoDrizzle(
  db: DB,
): PreventivaGeracaoRepo {
  return {
    async listarAtivas(): Promise<AssinaturaAtiva[]> {
      const rows = await db
        .select({
          assinaturaId: assinatura.id,
          clienteId: assinatura.clienteId,
          inicio: assinatura.inicio,
          preventivasPorAno: plano.preventivasPorAno,
          categorias: plano.categoriasPreventiva,
        })
        .from(assinatura)
        .innerJoin(plano, eq(assinatura.planoId, plano.id))
        .where(eq(assinatura.status, "ATIVA"));

      return rows
        .filter((r): r is typeof r & { inicio: Date } => r.inicio !== null)
        .map((r) => ({
          assinaturaId: r.assinaturaId,
          clienteId: r.clienteId,
          inicio: r.inicio,
          preventivasPorAno: r.preventivasPorAno,
          categorias: r.categorias,
        }));
    },

    async ultimaPreventivaPorCategoria(assinaturaId) {
      const rows = await db
        .select({
          categoria: ordemServico.categoria,
          ultima: max(ordemServico.agendadoPara),
        })
        .from(ordemServico)
        .where(
          and(
            eq(ordemServico.assinaturaId, assinaturaId),
            eq(ordemServico.tipo, "PREVENTIVA"),
          ),
        )
        .groupBy(ordemServico.categoria);

      const m = new Map<Categoria, Date>();
      for (const r of rows) if (r.ultima) m.set(r.categoria, r.ultima);
      return m;
    },

    async existeAberta(assinaturaId, categoria) {
      const [r] = await db
        .select({ id: ordemServico.id })
        .from(ordemServico)
        .where(
          and(
            eq(ordemServico.assinaturaId, assinaturaId),
            eq(ordemServico.categoria, categoria),
            eq(ordemServico.tipo, "PREVENTIVA"),
            inArray(ordemServico.estado, [...ESTADOS_ABERTOS]),
          ),
        )
        .limit(1);
      return Boolean(r);
    },

    async criarOsPreventiva(dados: NovaPreventiva) {
      const [cli] = await db
        .select({ endereco: cliente.endereco })
        .from(cliente)
        .where(eq(cliente.id, dados.clienteId))
        .limit(1);
      if (!cli?.endereco) return null; // sem endereço: não dá para agendar a visita

      const [sol] = await db
        .insert(solicitacao)
        .values({
          token: randomBytes(32).toString("hex"),
          clienteId: dados.clienteId,
          categorias: [dados.categoria],
          endereco: cli.endereco,
          origem: "PREVENTIVA",
        })
        .returning({ id: solicitacao.id });

      // Neon HTTP não tem transação multi-statement: se o insert da OS falha,
      // compensa apagando a solicitação-snapshot recém-criada.
      try {
        const [os] = await db
          .insert(ordemServico)
          .values({
            solicitacaoId: sol.id,
            tipo: "PREVENTIVA",
            estado: "AGENDADA",
            categoria: dados.categoria,
            assinaturaId: dados.assinaturaId,
            agendadoPara: dados.agendadoPara,
          })
          .returning({ id: ordemServico.id });
        return { osId: os.id };
      } catch (e) {
        await db.delete(solicitacao).where(eq(solicitacao.id, sol.id));
        throw e;
      }
    },
  };
}
