// Funções puras de agregação do dashboard (testáveis sem banco).

/**
 * Razão numerador/denominador como fração (0..1), ou `null` quando não há
 * base de cálculo (denominador zero) — evita divisão por zero e sinaliza
 * "sem dados" para a UI exibir "—" em vez de 0%.
 */
export function calcularPct(numerador: number, denominador: number): number | null {
  if (denominador === 0) return null;
  return numerador / denominador;
}

/**
 * MRR = soma dos preços das assinaturas ativas. Soma em centavos (inteiros)
 * para evitar erro de ponto flutuante, devolvendo string decimal com 2 casas
 * (mesmo formato monetário usado em todo o domínio).
 */
export function calcularMrr(ativas: { preco: string }[]): string {
  const centavos = ativas.reduce(
    (acc, a) => acc + Math.round(parseFloat(a.preco) * 100),
    0,
  );
  return (centavos / 100).toFixed(2);
}

export interface FunilEstagio {
  nome: "submissoes" | "orcados" | "aprovados" | "concluidos";
  total: number;
  conversao: number | null; // fração relativa à etapa anterior (1ª = null)
}

/**
 * Funil de marketing de 4 estágios (submissões→orçados→aprovados→concluídos).
 * A conversão de cada etapa é seu total dividido pelo total da etapa anterior;
 * a 1ª etapa (topo) não tem anterior, logo `conversao = null`. (O estágio de
 * "visitas à landing" fica fora por ora — não há instrumentação de pageview.)
 */
export function montarFunil(totais: {
  submissoes: number;
  orcados: number;
  aprovados: number;
  concluidos: number;
}): FunilEstagio[] {
  const etapas: { nome: FunilEstagio["nome"]; total: number }[] = [
    { nome: "submissoes", total: totais.submissoes },
    { nome: "orcados", total: totais.orcados },
    { nome: "aprovados", total: totais.aprovados },
    { nome: "concluidos", total: totais.concluidos },
  ];
  return etapas.map((etapa, i) => ({
    nome: etapa.nome,
    total: etapa.total,
    conversao: i === 0 ? null : calcularPct(etapa.total, etapas[i - 1].total),
  }));
}
