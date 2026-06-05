import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { tratativa, membro } from "@/db/schema";
import type { TratativaRepo, TratativaInput, TratativaView } from "./tratativa-repo";

export function criarTratativaRepoDrizzle(db: DB): TratativaRepo {
  return {
    async criar(dados: TratativaInput): Promise<void> {
      await db.insert(tratativa).values({
        alertaAvaliacaoId: dados.alertaAvaliacaoId,
        osId: dados.osId,
        tipo: dados.tipo,
        descricao: dados.descricao,
        responsavelId: dados.responsavelId,
        data: dados.data,
      });
    },

    async listarPorAlerta(alertaAvaliacaoId: string): Promise<TratativaView[]> {
      const rows = await db
        .select({
          id: tratativa.id,
          alertaAvaliacaoId: tratativa.alertaAvaliacaoId,
          osId: tratativa.osId,
          tipo: tratativa.tipo,
          descricao: tratativa.descricao,
          responsavelId: tratativa.responsavelId,
          responsavelNome: membro.nome,
          data: tratativa.data,
          criadoEm: tratativa.criadoEm,
        })
        .from(tratativa)
        .leftJoin(membro, eq(tratativa.responsavelId, membro.id))
        .where(eq(tratativa.alertaAvaliacaoId, alertaAvaliacaoId))
        .orderBy(tratativa.criadoEm);

      return rows.map((r) => ({
        id: r.id,
        alertaAvaliacaoId: r.alertaAvaliacaoId,
        osId: r.osId,
        tipo: r.tipo,
        descricao: r.descricao,
        responsavelId: r.responsavelId,
        responsavelNome: r.responsavelNome ?? null,
        data: r.data,
        criadoEm: r.criadoEm,
      }));
    },
  };
}
