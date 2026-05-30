import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type { EstadoOs } from "./orcamento-repo";
import type { TransicaoRepo } from "./transicao-repo";

export function criarTransicaoRepoDrizzle(db: DB): TransicaoRepo {
  return {
    async carregarContexto(osId) {
      const [os] = await db
        .select({
          tipo: ordemServico.tipo,
          estado: ordemServico.estado,
        })
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);
      if (!os) return null;

      const rows = await db
        .select({
          estadoAnterior: transicaoOs.estadoAnterior,
          estadoNovo: transicaoOs.estadoNovo,
        })
        .from(transicaoOs)
        .where(eq(transicaoOs.osId, osId))
        .orderBy(asc(transicaoOs.em));

      // Histórico = estados percorridos em ordem. Parte do estado inicial da
      // primeira transição e acumula cada estadoNovo; sem transições, é o
      // estado atual.
      const historico: EstadoOs[] =
        rows.length > 0
          ? [rows[0].estadoAnterior, ...rows.map((r) => r.estadoNovo)]
          : [os.estado];

      return { tipo: os.tipo, estado: os.estado, historico };
    },

    async persistir(osId, registro) {
      // Atomicidade via batch (neon-http): insere o histórico e atualiza o
      // estado da OS no mesmo round-trip.
      await db.batch([
        db.insert(transicaoOs).values({
          osId,
          estadoAnterior: registro.estadoAnterior,
          estadoNovo: registro.estadoNovo,
          atorEmail: registro.atorEmail,
          motivo: registro.motivo,
          em: new Date(registro.em),
        }),
        db
          .update(ordemServico)
          .set({ estado: registro.estadoNovo })
          .where(eq(ordemServico.id, osId)),
      ]);
    },
  };
}
