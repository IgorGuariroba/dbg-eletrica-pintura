import type { EstadoOs } from "./orcamento-repo";

/** Estados em que o serviço foi entregue ao cliente. Fonte única do conjunto:
 * predicado `foiEntregue` (runtime) e filtros SQL (`inArray`) derivam daqui. */
export const ESTADOS_ENTREGUES = ["CONCLUIDA", "PAGA"] as const;

/** OS pode iniciar cobrança: serviço concluído (PAGA já está paga). */
export function podeCobrar(estado: EstadoOs): boolean {
  return estado === "CONCLUIDA";
}

/** OS entregue ao cliente: concluída ou já paga. Base p/ garantia e checkout. */
export function foiEntregue(estado: EstadoOs): boolean {
  return (ESTADOS_ENTREGUES as readonly string[]).includes(estado);
}
