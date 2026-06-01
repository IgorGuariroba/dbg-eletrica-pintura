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
