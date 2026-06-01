import type { ComponentProps } from "react";
import type { Badge } from "@/components/ui/badge";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/** Rótulo amigável da categoria de serviço, exibido no portal do cliente. */
export const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

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
