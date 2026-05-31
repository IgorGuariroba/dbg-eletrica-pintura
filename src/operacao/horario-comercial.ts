import { disponibilidadeSchema } from "@/equipe/validacao";
import type {
  DiaSemana,
  DisponibilidadeSemanal,
  JanelaHorario,
} from "@/equipe/membro-repo";

export type { DiaSemana, JanelaHorario } from "@/equipe/membro-repo";

/**
 * Horário comercial da empresa por dia da semana. Mesma shape da
 * disponibilidade do técnico: janela aberta, ou ausente/`null` = fechado.
 * Define a janela máxima de slots — a disponibilidade individual nunca a expande.
 */
export type HorarioComercial = Partial<Record<DiaSemana, JanelaHorario | null>>;

/** Horário comercial de fábrica: seg-sex 8h-18h, sáb 8h-12h, dom fechado. */
export const HORARIO_COMERCIAL_PADRAO: HorarioComercial = {
  dom: null,
  seg: { inicio: "08:00", fim: "18:00" },
  ter: { inicio: "08:00", fim: "18:00" },
  qua: { inicio: "08:00", fim: "18:00" },
  qui: { inicio: "08:00", fim: "18:00" },
  sex: { inicio: "08:00", fim: "18:00" },
  sab: { inicio: "08:00", fim: "12:00" },
};

/**
 * Confronta a disponibilidade de um técnico com o horário comercial e devolve
 * os dias em que a janela individual extrapola (ou ocorre fora) do comercial.
 * Lista vazia = disponibilidade contida no comercial.
 */
/**
 * Valida/normaliza um horário comercial cru. Reaproveita a mesma checagem de
 * janela da disponibilidade do técnico (HH:MM, início < fim, `null` = fechado).
 * Lança `ZodError` quando alguma janela é inválida.
 */
export function validarHorarioComercial(raw: unknown): HorarioComercial {
  return disponibilidadeSchema.parse(raw);
}

const DIAS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function disponibilidadeDentroDoComercial(
  disponibilidade: DisponibilidadeSemanal,
  comercial: HorarioComercial,
): DiaSemana[] {
  return DIAS.filter((dia) => {
    const janela = disponibilidade[dia];
    if (!janela) return false;
    const aberto = comercial[dia];
    if (!aberto) return true; // empresa fechada nesse dia: técnico não pode atender
    return janela.inicio < aberto.inicio || janela.fim > aberto.fim;
  });
}
