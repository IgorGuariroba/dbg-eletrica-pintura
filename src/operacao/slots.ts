import type { Categoria, DiaSemana, DisponibilidadeSemanal } from "@/equipe/membro-repo";
import type { HorarioComercial } from "./horario-comercial";

export interface TecnicoAgendavel {
  id: string;
  especialidades: Categoria[];
  disponibilidade: DisponibilidadeSemanal | null;
  ocupacoes: Date[];
}

export interface SlotDisponivel {
  inicio: Date;
  duracaoMin: number;
  tecnicoId: string;
}

const DIAS: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

/**
 * Offset de America/Sao_Paulo: UTC = horário local + 3h. O Brasil é fixo em
 * UTC-3 desde o fim do horário de verão (2019), então os horários comerciais
 * e de disponibilidade ("08:00", "18:00") são interpretados como hora local de
 * SP e convertidos para o instante UTC correspondente.
 */
const OFFSET_SP_HORAS = 3;

export function calcularSlotsDisponiveis(input: {
  inicio: Date;
  fim: Date;
  categoria: Categoria;
  horarioComercial: HorarioComercial;
  tecnicos: TecnicoAgendavel[];
  duracaoMin?: number;
  assinante?: boolean;
}): SlotDisponivel[] {
  const {
    inicio,
    fim,
    categoria,
    horarioComercial,
    tecnicos,
    duracaoMin = 60,
  } = input;

  const slots: SlotDisponivel[] = [];

  // Iterar dia por dia no range [inicio, fim]
  // Começamos normalizando o início para o começo daquele dia local
  // Iterar dia por dia no range [inicio, fim]
  // Começamos normalizando o início para o começo daquele dia em UTC
  const dataAtual = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
  const dataLimite = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()));

  for (
    let d = new Date(dataAtual.getTime());
    d <= dataLimite;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const diaSemana = DIAS[d.getUTCDay()];

    const comercialJanela = horarioComercial[diaSemana];
    if (!comercialJanela) continue;

    for (const tecnico of tecnicos) {
      // 1. Filtra técnicos pela categoria
      if (!tecnico.especialidades.includes(categoria)) continue;

      const tecnicoJanela = tecnico.disponibilidade?.[diaSemana];
      if (!tecnicoJanela) continue;

      // 2. Interseção da janela comercial com a disponibilidade do técnico
      const inicioJanela =
        comercialJanela.inicio > tecnicoJanela.inicio
          ? comercialJanela.inicio
          : tecnicoJanela.inicio;
      const fimJanela =
        comercialJanela.fim < tecnicoJanela.fim
          ? comercialJanela.fim
          : tecnicoJanela.fim;

      if (inicioJanela >= fimJanela) continue;

      // 3. Quebrar janela em slots
      const [startH, startM] = inicioJanela.split(":").map(Number);
      const [endH, endM] = fimJanela.split(":").map(Number);

      // Horários vêm como hora local de SP; somamos o offset para obter o
      // instante UTC real do slot (ex.: 08:00 SP -> 11:00Z).
      const slotStart = new Date(d.getTime());
      slotStart.setUTCHours(startH + OFFSET_SP_HORAS, startM, 0, 0);

      const slotEndLimit = new Date(d.getTime());
      slotEndLimit.setUTCHours(endH + OFFSET_SP_HORAS, endM, 0, 0);

      let slotTime = new Date(slotStart.getTime());

      while (true) {
        const slotFim = new Date(slotTime.getTime() + duracaoMin * 60 * 1000);
        if (slotFim > slotEndLimit) break;

        // Validar se o slot está inteiramente dentro do range do input [inicio, fim]
        if (slotTime >= inicio && slotFim <= fim) {
          // Verificar colisão com ocupações existentes do técnico
          const colide = tecnico.ocupacoes.some((ocupacaoStart) => {
            const oStart = ocupacaoStart.getTime();
            const oEnd = oStart + duracaoMin * 60 * 1000;
            const sStart = slotTime.getTime();
            const sEnd = slotFim.getTime();
            return sStart < oEnd && oStart < sEnd;
          });

          if (!colide) {
            slots.push({
              inicio: new Date(slotTime.getTime()),
              duracaoMin,
              tecnicoId: tecnico.id,
            });
          }
        }

        slotTime.setUTCMinutes(slotTime.getUTCMinutes() + duracaoMin);
      }
    }
  }

  // Ordenar por início e depois por técnico
  return slots.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}
