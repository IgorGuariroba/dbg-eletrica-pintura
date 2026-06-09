import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, max } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  assinatura,
  cliente,
  ordemServico,
  plano,
  solicitacao,
  transicaoOs,
} from "@/db/schema";
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
      // A cadência conta da CONCLUSÃO real da última preventiva — não da data
      // agendada nem de preventivas canceladas. A data vem do registro da
      // transição → CONCLUIDA (`transicaoOs.em`).
      const rows = await db
        .select({
          categoria: ordemServico.categoria,
          ultima: max(transicaoOs.em),
        })
        .from(ordemServico)
        .innerJoin(
          transicaoOs,
          and(
            eq(transicaoOs.osId, ordemServico.id),
            eq(transicaoOs.estadoNovo, "CONCLUIDA"),
          ),
        )
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

      // IDs gerados aqui para encadear solicitação → OS num único `db.batch`
      // (transação atômica do neon-http): ou as duas linhas entram, ou nenhuma.
      const solId = randomUUID();
      const osId = randomUUID();
      await db.batch([
        db.insert(solicitacao).values({
          id: solId,
          token: randomBytes(32).toString("hex"),
          clienteId: dados.clienteId,
          categorias: [dados.categoria],
          endereco: cli.endereco,
          origem: "PREVENTIVA",
        }),
        db.insert(ordemServico).values({
          id: osId,
          solicitacaoId: solId,
          tipo: "PREVENTIVA",
          estado: "AGENDADA",
          categoria: dados.categoria,
          assinaturaId: dados.assinaturaId,
          agendadoPara: dados.agendadoPara,
        }),
      ]);
      return { osId };
    },
  };
}
