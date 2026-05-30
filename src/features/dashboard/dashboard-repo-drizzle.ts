import { and, count, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import { membro, ordemServico, servico } from "@/db/schema";
import type { Categoria } from "@/operacao/fila-repo";
import type { DashboardRepo } from "./dashboard";

export function criarDashboardRepoDrizzle(db: DB): DashboardRepo {
  async function contar(
    tabela: typeof servico | typeof membro | typeof ordemServico,
    where: SQL | undefined,
  ) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(tabela)
      .where(where ?? sql`true`);
    return Number(value);
  }

  const possuiModulo = sql`coalesce(array_length(${membro.modulos}, 1), 0) > 0`;

  return {
    contarServicosAtivos() {
      return contar(servico, eq(servico.ativo, true));
    },
    contarTecnicosAtivos() {
      return contar(membro, and(eq(membro.isTecnico, true), eq(membro.ativo, true)));
    },
    contarMembrosInternos() {
      return contar(membro, and(possuiModulo, eq(membro.ativo, true)));
    },
    contarOsCriadasHoje() {
      return contar(ordemServico, gte(ordemServico.criadoEm, sql`date_trunc('day', now())`));
    },
    contarOsNovasNaFila() {
      return contar(
        ordemServico,
        and(eq(ordemServico.estado, "NOVA"), isNull(ordemServico.tecnicoId)),
      );
    },
    contarOsAguardandoAprovacao() {
      return contar(ordemServico, eq(ordemServico.estado, "ORCADA"));
    },
    contarOsAtribuidasA(tecnicoId: string) {
      return contar(ordemServico, eq(ordemServico.tecnicoId, tecnicoId));
    },
    contarMinhaFila(especialidades: Categoria[]) {
      if (especialidades.length === 0) return Promise.resolve(0);
      return contar(
        ordemServico,
        and(
          eq(ordemServico.estado, "NOVA"),
          isNull(ordemServico.tecnicoId),
          inArray(ordemServico.categoria, especialidades),
        ),
      );
    },
  };
}
