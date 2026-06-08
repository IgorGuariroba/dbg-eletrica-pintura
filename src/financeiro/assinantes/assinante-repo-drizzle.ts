import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type {
  AssinanteListItem,
  AssinanteRepo,
  ListarAssinantesFiltro,
} from "./assinante-repo";

export function criarAssinanteRepoDrizzle(db: DB): AssinanteRepo {
  return {
    async listarAssinantes(
      filtro: ListarAssinantesFiltro = {},
    ): Promise<AssinanteListItem[]> {
      const conds = [];
      if (filtro.status) conds.push(eq(assinatura.status, filtro.status));
      if (filtro.planoId) conds.push(eq(assinatura.planoId, filtro.planoId));
      const where = conds.length ? and(...conds) : undefined;

      const rows = await db
        .select({
          assinaturaId: assinatura.id,
          clienteNome: cliente.nome,
          planoNome: plano.nome,
          status: assinatura.status,
          valorMensal: plano.preco,
          inicio: assinatura.inicio,
          fimCicloAtual: assinatura.fimCicloAtual,
        })
        .from(assinatura)
        .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
        .innerJoin(plano, eq(assinatura.planoId, plano.id))
        .where(where)
        .orderBy(desc(assinatura.criadoEm));

      return rows.map((r) => ({
        assinaturaId: r.assinaturaId,
        clienteNome: r.clienteNome,
        planoNome: r.planoNome,
        status: r.status,
        valorMensal: r.valorMensal,
        inicio: r.inicio,
        // Próxima preventiva derivada do fim do ciclo atual (best-effort até #6).
        proximaPreventiva: r.fimCicloAtual,
      }));
    },
  };
}
