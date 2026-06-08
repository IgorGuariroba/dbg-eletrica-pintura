import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ehViolacaoUnica } from "@/db/client";
import {
  assinatura,
  cliente,
  membro,
  operacaoConfig,
  ordemServico,
  solicitacao,
  transicaoOs,
} from "@/db/schema";
import type {
  AgendamentoDadosOs,
  AgendamentoRepo,
  TransicaoRegistro,
} from "./agendamento-repo";
import type { Categoria, EstadoOs } from "./orcamento-repo";
import { SlotIndisponivelError } from "./agendamento";
import { HORARIO_COMERCIAL_PADRAO, type HorarioComercial } from "./horario-comercial";
import type { TecnicoAgendavel } from "./slots";

const SINGLETON_CONFIG_ID = "default";

export function criarAgendamentoRepoDrizzle(db: DB): AgendamentoRepo {
  return {
    async buscarOs(osId: string): Promise<AgendamentoDadosOs | null> {
      const [row] = await db
        .select({
          id: ordemServico.id,
          estado: ordemServico.estado,
          categoria: ordemServico.categoria,
          tecnicoId: ordemServico.tecnicoId,
          agendadoPara: ordemServico.agendadoPara,
          clienteAssinante: sql<boolean>`case when ${assinatura.id} is not null then true else false end`,
          clienteWhatsapp: cliente.whatsapp,
        })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .leftJoin(
          assinatura,
          and(
            eq(assinatura.clienteId, cliente.id),
            eq(assinatura.status, "ATIVA")
          )
        )
        .where(eq(ordemServico.id, osId))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        estado: row.estado as EstadoOs,
        categoria: row.categoria as Categoria,
        tecnicoId: row.tecnicoId,
        agendadoPara: row.agendadoPara ? new Date(row.agendadoPara) : null,
        clienteAssinante: row.clienteAssinante ?? false,
        clienteWhatsapp: row.clienteWhatsapp,
      };
    },

    async buscarOsComToken(token: string, osId: string): Promise<AgendamentoDadosOs | null> {
      const [row] = await db
        .select({
          id: ordemServico.id,
          estado: ordemServico.estado,
          categoria: ordemServico.categoria,
          tecnicoId: ordemServico.tecnicoId,
          agendadoPara: ordemServico.agendadoPara,
          clienteAssinante: sql<boolean>`case when ${assinatura.id} is not null then true else false end`,
          clienteWhatsapp: cliente.whatsapp,
        })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .leftJoin(
          assinatura,
          and(
            eq(assinatura.clienteId, cliente.id),
            eq(assinatura.status, "ATIVA")
          )
        )
        .where(
          and(
            eq(solicitacao.token, token),
            eq(ordemServico.id, osId)
          )
        )
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        estado: row.estado as EstadoOs,
        categoria: row.categoria as Categoria,
        tecnicoId: row.tecnicoId,
        agendadoPara: row.agendadoPara ? new Date(row.agendadoPara) : null,
        clienteAssinante: row.clienteAssinante ?? false,
        clienteWhatsapp: row.clienteWhatsapp,
      };
    },

    async listarTecnicosAgendaveis(categoria: Categoria): Promise<TecnicoAgendavel[]> {
      const matchingTecnicos = await db
        .select()
        .from(membro)
        .where(
          and(
            eq(membro.isTecnico, true),
            eq(membro.ativo, true),
            sql`${categoria} = ANY(${membro.especialidades})`
          )
        );

      if (matchingTecnicos.length === 0) {
        return [];
      }

      const tecnicoIds = matchingTecnicos.map((t) => t.id);

      const ocupacoesDb = await db
        .select({
          tecnicoId: ordemServico.tecnicoId,
          agendadoPara: ordemServico.agendadoPara,
        })
        .from(ordemServico)
        .where(
          and(
            inArray(ordemServico.tecnicoId, tecnicoIds),
            inArray(ordemServico.estado, [
              "AGENDADA",
              "A_CAMINHO",
              "NO_LOCAL",
              "EM_EXECUCAO",
            ])
          )
        );

      const ocupacoesPorTecnico: Record<string, Date[]> = {};
      for (const tid of tecnicoIds) {
        ocupacoesPorTecnico[tid] = [];
      }
      for (const o of ocupacoesDb) {
        if (o.tecnicoId && o.agendadoPara) {
          ocupacoesPorTecnico[o.tecnicoId].push(new Date(o.agendadoPara));
        }
      }

      return matchingTecnicos.map((t) => ({
        id: t.id,
        especialidades: t.especialidades as Categoria[],
        disponibilidade: t.disponibilidade as any,
        ocupacoes: ocupacoesPorTecnico[t.id],
      }));
    },

    async obterHorarioComercial(): Promise<HorarioComercial> {
      const [row] = await db
        .select({ horarioComercial: operacaoConfig.horarioComercial })
        .from(operacaoConfig)
        .where(eq(operacaoConfig.id, SINGLETON_CONFIG_ID))
        .limit(1);

      return (row?.horarioComercial as HorarioComercial) ?? HORARIO_COMERCIAL_PADRAO;
    },

    async salvarAgendamento(
      osId: string,
      slot: Date,
      tecnicoId: string,
      transicao: TransicaoRegistro
    ): Promise<void> {
      try {
        await db.batch([
          db
            .update(ordemServico)
            .set({
              estado: transicao.estadoNovo,
              tecnicoId,
              agendadoPara: slot,
            })
            .where(eq(ordemServico.id, osId)),
          db.insert(transicaoOs).values({
            osId,
            estadoAnterior: transicao.estadoAnterior,
            estadoNovo: transicao.estadoNovo,
            atorEmail: transicao.atorEmail,
            motivo: transicao.motivo,
            em: transicao.em,
          }),
        ]);
      } catch (error) {
        if (ehViolacaoUnica(error)) {
          throw new SlotIndisponivelError(tecnicoId, slot);
        }
        throw error;
      }
    },

    async liberarAgendamento(
      osId: string,
      novoEstado: EstadoOs,
      transicao: TransicaoRegistro
    ): Promise<void> {
      await db.batch([
        db
          .update(ordemServico)
          .set({
            estado: novoEstado,
            tecnicoId: null,
            agendadoPara: null,
          })
          .where(eq(ordemServico.id, osId)),
        db.insert(transicaoOs).values({
          osId,
          estadoAnterior: transicao.estadoAnterior,
          estadoNovo: transicao.estadoNovo,
          atorEmail: transicao.atorEmail,
          motivo: transicao.motivo,
          em: transicao.em,
        }),
      ]);
    },
  };
}
