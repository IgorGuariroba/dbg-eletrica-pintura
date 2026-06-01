import type { DB } from "@/db/client";
import { ordemServico, solicitacao } from "@/db/schema";
import { and, eq, gte, inArray, lte, asc } from "drizzle-orm";
import type { Categoria } from "@/equipe/membro-repo";
import type { EstadoOs } from "./orcamento-repo";

export interface ItemAgenda {
  osId: string;
  categoria: Categoria;
  agendadoPara: Date;
  endereco: string;
  estado: EstadoOs;
}

type Endereco = NonNullable<typeof solicitacao.$inferSelect.endereco>;

function formatarEndereco(end: Endereco): string {
  const partes = [end.logradouro];
  if (end.numero) partes.push(end.numero);
  if (end.bairro) partes.push(end.bairro);
  partes.push(`${end.cidade}/${end.uf}`);
  return partes.join(", ");
}

export async function agendaDoTecnico(
  db: DB,
  tecnicoId: string,
  agora: Date,
): Promise<ItemAgenda[]> {
  const dataInicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 0, 0, 0, 0));
  const dataFim = new Date(dataInicio.getTime() + 8 * 24 * 60 * 60 * 1000 - 1);

  const rows = await db
    .select({
      osId: ordemServico.id,
      categoria: ordemServico.categoria,
      agendadoPara: ordemServico.agendadoPara,
      endereco: solicitacao.endereco,
      estado: ordemServico.estado,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .where(
      and(
        eq(ordemServico.tecnicoId, tecnicoId),
        inArray(ordemServico.estado, ["AGENDADA", "A_CAMINHO", "NO_LOCAL", "EM_EXECUCAO"]),
        gte(ordemServico.agendadoPara, dataInicio),
        lte(ordemServico.agendadoPara, dataFim)
      )
    )
    .orderBy(asc(ordemServico.agendadoPara));

  return rows.map((r) => ({
    osId: r.osId,
    categoria: r.categoria as Categoria,
    agendadoPara: r.agendadoPara!,
    endereco: formatarEndereco(r.endereco),
    estado: r.estado as EstadoOs,
  }));
}
