import type { DisponibilidadeSemanal, Membro, MembroRepo } from "@/equipe/membro-repo";
import { disponibilidadeSchema } from "@/equipe/validacao";
import type { OperacaoConfigRepo } from "./config-repo";
import {
  type DiaSemana,
  disponibilidadeDentroDoComercial,
} from "./horario-comercial";

export class DisponibilidadeForaDoComercialError extends Error {
  constructor(public readonly dias: DiaSemana[]) {
    super(
      `Disponibilidade fora do horário comercial nos dias: ${dias.join(", ")}`,
    );
    this.name = "DisponibilidadeForaDoComercialError";
  }
}

export interface AtualizarDisponibilidadeInput {
  tecnicoId: string;
  disponibilidade: DisponibilidadeSemanal;
}

export interface AtualizarDisponibilidadeDeps {
  membroRepo: MembroRepo;
  configRepo: OperacaoConfigRepo;
}

/**
 * Atualiza a disponibilidade individual de um técnico, garantindo que ela
 * permaneça contida no horário comercial vigente. Fora do range → lança
 * `DisponibilidadeForaDoComercialError` sem tocar no banco.
 */
export async function atualizarDisponibilidadeTecnico(
  input: AtualizarDisponibilidadeInput,
  deps: AtualizarDisponibilidadeDeps,
): Promise<Membro | null> {
  const disponibilidade = disponibilidadeSchema.parse(input.disponibilidade);
  const { horarioComercial } = await deps.configRepo.obter();

  const violacoes = disponibilidadeDentroDoComercial(
    disponibilidade,
    horarioComercial,
  );
  if (violacoes.length > 0) {
    throw new DisponibilidadeForaDoComercialError(violacoes);
  }

  return deps.membroRepo.atualizar(input.tecnicoId, { disponibilidade });
}

export interface AtorDisponibilidade {
  id: string;
  podeGerenciarEquipe: boolean;
}

/**
 * Decide se o ator pode editar a disponibilidade do técnico-alvo: ou é o
 * próprio técnico, ou tem gestão de Equipe (membro Equipe / admin raiz).
 */
export function podeEditarDisponibilidade(
  ator: AtorDisponibilidade,
  alvoId: string,
): boolean {
  return ator.podeGerenciarEquipe || ator.id === alvoId;
}
