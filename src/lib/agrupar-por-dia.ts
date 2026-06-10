const TZ = "America/Sao_Paulo";

/**
 * Agrupa itens pelo dia-calendário no fuso de São Paulo (não pelo dia UTC),
 * em ordem cronológica. `data` é a do primeiro item do grupo — útil para o
 * componente formatar o rótulo do dia com o Intl.DateTimeFormat que preferir.
 */
export function agruparPorDiaSP<T>(
  itens: T[],
  obterData: (item: T) => Date | string,
): { data: Date; itens: T[] }[] {
  const grupos = new Map<string, { data: Date; itens: T[] }>();
  for (const item of itens) {
    const d = new Date(obterData(item));
    const chave = d.toLocaleDateString("en-CA", { timeZone: TZ });
    const grupo = grupos.get(chave) ?? { data: d, itens: [] };
    grupo.itens.push(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.data.getTime() - b.data.getTime());
}
