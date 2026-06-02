import type { Periodo } from "./financeiro";

/**
 * Retorna o intervalo { inicio, fim } para o período especificado.
 * As datas de início são ajustadas para 00:00:00 do fuso horário America/Sao_Paulo (UTC-3),
 * o que equivale a 03:00:00 UTC.
 */
export function intervaloPeriodo(p: Periodo, agora: Date): { inicio: Date; fim: Date } {
  // Ajusta para o horário local de SP (UTC-3) para cálculo do dia/semana/mês civil
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  
  const ano = local.getUTCFullYear();
  const mes = local.getUTCMonth();
  const dia = local.getUTCDate();

  const inicioLocal = new Date(local);

  if (p === "dia") {
    // Início do dia local
    return {
      inicio: new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0)),
      fim: agora,
    };
  } else if (p === "semana") {
    // Segunda-feira do dia local
    const day = local.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    inicioLocal.setUTCDate(dia - diff);
    
    return {
      inicio: new Date(Date.UTC(inicioLocal.getUTCFullYear(), inicioLocal.getUTCMonth(), inicioLocal.getUTCDate(), 3, 0, 0, 0)),
      fim: agora,
    };
  } else {
    // Primeiro dia do mês local
    return {
      inicio: new Date(Date.UTC(ano, mes, 1, 3, 0, 0, 0)),
      fim: agora,
    };
  }
}
