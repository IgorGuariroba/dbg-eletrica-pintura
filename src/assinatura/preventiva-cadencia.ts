/**
 * Cadência das visitas preventivas de uma assinatura. O plano define quantas
 * preventivas o assinante tem direito por ano (`preventivasPorAno`); daí sai o
 * intervalo entre visitas e a data da próxima visita devida.
 *
 * Datas tratadas em UTC para o cálculo ser determinístico (independe do fuso
 * do servidor onde o cron roda).
 */

/** Intervalo (em meses) entre preventivas. 0/ano → nunca (Infinity). */
export function cadenciaMeses(preventivasPorAno: number): number {
  if (preventivasPorAno <= 0) return Number.POSITIVE_INFINITY;
  return 12 / preventivasPorAno;
}

/**
 * Soma `meses` a uma data (UTC). Meses inteiros preservam o dia, com clamp para
 * o último dia do mês quando estoura (ex.: 31/jan + 1 mês → 28/fev). A parte
 * fracionária (planos cuja divisão não é exata) vira dias (~30,44/mês).
 */
function addMeses(d: Date, meses: number): Date {
  const inteiros = Math.trunc(meses);
  const frac = meses - inteiros;
  const r = new Date(d);
  const dia = r.getUTCDate();
  r.setUTCMonth(r.getUTCMonth() + inteiros);
  if (r.getUTCDate() < dia) r.setUTCDate(0); // clamp fim-de-mês
  if (frac > 0) r.setUTCDate(r.getUTCDate() + Math.round(frac * 30.44));
  return r;
}

/**
 * Data da próxima preventiva devida, ou `null` se ainda não venceu (ou o plano
 * não inclui preventivas). A base é a última preventiva realizada; sem ela, o
 * início da assinatura. "Devida" = a data calculada já é <= hoje.
 */
export function proximaPreventivaDevida(
  inicio: Date,
  ultima: Date | null,
  preventivasPorAno: number,
  hoje: Date,
): Date | null {
  const cadencia = cadenciaMeses(preventivasPorAno);
  if (!Number.isFinite(cadencia)) return null;
  const proxima = addMeses(ultima ?? inicio, cadencia);
  return proxima.getTime() <= hoje.getTime() ? proxima : null;
}
