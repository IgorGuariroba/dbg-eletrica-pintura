import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

// Fonte única do rótulo de categoria vive no domínio Operação.
export { LABEL_CATEGORIA } from "@/operacao/rotulo-estado";

/** Variante visual do badge por estado da OS (rótulo vem de rotularEstadoCliente). */
export const VARIANTE_ESTADO: Record<string, BadgeVariant> = {
  NOVA: "secondary",
  REJEITADA: "destructive",
  EXPIRADA: "outline",
  CANCELADA: "outline",
};

/** Data curta no fuso de São Paulo (dd/mm/aaaa). */
export function dataCurta(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
