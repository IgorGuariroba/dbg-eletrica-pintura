/**
 * Rótulos de estado da OS em linguagem amigável para o cliente, usados no link
 * público de acompanhamento. Fallback: o próprio estado.
 */
const ROTULOS: Record<string, string> = {
  NOVA: "Em análise",
  ORCADA: "Aguardando sua aprovação",
  APROVADA: "Aprovado",
  REJEITADA: "Recusado",
  EXPIRADA: "Expirado",
  AGENDADA: "Visita agendada",
  A_CAMINHO: "Técnico a caminho",
  NO_LOCAL: "Técnico no local",
  EM_EXECUCAO: "Serviço em andamento",
  CONCLUIDA: "Serviço concluído",
  PAGA: "Pago",
  CANCELADA: "Cancelado",
};

export function rotularEstadoCliente(estado: string): string {
  return ROTULOS[estado] ?? estado;
}

/**
 * Rótulo amigável da categoria de serviço, exibido nas telas voltadas ao
 * cliente (acompanhamento, portal, checkout). Fallback: a própria categoria.
 */
export const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export function rotularCategoria(categoria: string): string {
  return LABEL_CATEGORIA[categoria] ?? categoria;
}

/**
 * Rótulos de estado em linguagem operacional (curta), exibidos nas telas
 * internas de operação e na agenda do técnico. Fallback: o próprio estado.
 */
const ROTULOS_OPERACAO: Record<string, string> = {
  NOVA: "Nova",
  ORCADA: "Orçada",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  EXPIRADA: "Expirada",
  AGENDADA: "Agendada",
  A_CAMINHO: "A caminho",
  NO_LOCAL: "No local",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

export function rotularEstadoOperacao(estado: string): string {
  return ROTULOS_OPERACAO[estado] ?? estado;
}

/**
 * Variante semântica de `Badge` por estado da OS — única fonte de cor de estado.
 * Usa exclusivamente tokens do Design System (sem cores brutas do Tailwind).
 */
export type VarianteEstado =
  | "default"
  | "secondary"
  | "destructive"
  | "warning"
  | "outline";

const VARIANTE_ESTADO: Record<string, VarianteEstado> = {
  APROVADA: "secondary",
  AGENDADA: "default",
  A_CAMINHO: "warning",
  NO_LOCAL: "warning",
  EM_EXECUCAO: "default",
  CONCLUIDA: "secondary",
  PAGA: "secondary",
  CANCELADA: "destructive",
};

export function varianteEstado(estado: string): VarianteEstado {
  return VARIANTE_ESTADO[estado] ?? "outline";
}
