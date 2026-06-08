import type { DB } from "@/db/client";
import { membro, ordemServico } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Categoria } from "@/equipe/membro-repo";
import type { SlotDisponivel } from "./slots";
import { calcularSlotsDisponiveis } from "./slots";
import type { OperacaoConfigRepo } from "./config-repo";

export interface ListarSlotsInput {
  inicio: Date;
  fim: Date;
  categoria: Categoria;
  duracaoMin?: number;
  /** Cliente com assinatura ativa → slots marcados com prioridade (#56). */
  assinante?: boolean;
}

export interface SlotsLoaderDeps {
  configRepo: OperacaoConfigRepo;
}

export async function listarSlotsDisponiveis(
  db: DB,
  input: ListarSlotsInput,
  deps: SlotsLoaderDeps
): Promise<SlotDisponivel[]> {
  const { inicio, fim, categoria, duracaoMin, assinante } = input;

  // 1. Carrega todos os membros ativos que são técnicos com a especialidade desejada no banco
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

  // 2. Buscar ocupações ativas (AGENDADA, A_CAMINHO, NO_LOCAL, EM_EXECUCAO)
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

  // Agrupar ocupações por técnico
  const ocupacoesPorTecnico: Record<string, Date[]> = {};
  for (const tid of tecnicoIds) {
    ocupacoesPorTecnico[tid] = [];
  }
  for (const o of ocupacoesDb) {
    if (o.tecnicoId && o.agendadoPara) {
      ocupacoesPorTecnico[o.tecnicoId].push(new Date(o.agendadoPara));
    }
  }

  // 3. Obter o horário comercial configurado
  const { horarioComercial } = await deps.configRepo.obter();

  // 4. Mapear para o formato TecnicoAgendavel do motor puro
  const tecnicosAgendaveis = matchingTecnicos.map((t) => ({
    id: t.id,
    especialidades: t.especialidades as Categoria[],
    disponibilidade: t.disponibilidade,
    ocupacoes: ocupacoesPorTecnico[t.id],
  }));

  return calcularSlotsDisponiveis({
    inicio,
    fim,
    categoria,
    horarioComercial,
    tecnicos: tecnicosAgendaveis,
    duracaoMin,
    assinante,
  });
}
