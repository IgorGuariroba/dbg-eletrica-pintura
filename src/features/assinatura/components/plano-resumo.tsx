import { Check, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

/** Quebra o texto livre de benefícios (uma linha por benefício) em itens. */
export function beneficiosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export interface PlanoResumoData {
  nome: string;
  preco: string;
  percentualDesconto: string;
  preventivasPorAno: number;
  prioridadeAgendamento: boolean;
  beneficios: string | null;
}

/**
 * Cabeçalho + lista de benefícios de um plano (nome, preço/mês, badge de
 * prioridade, desconto, preventivas e benefícios livres). Compartilhado entre a
 * vitrine `/planos` e a landing de assinatura `/assinar/{slug}`. O caller
 * fornece o `<Card>` e o rodapé (CTA), que variam por contexto.
 */
export function PlanoResumo({ plano }: { plano: PlanoResumoData }) {
  const beneficios = beneficiosDe(plano.beneficios);
  const desconto = Number(plano.percentualDesconto);

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{plano.nome}</span>
          {plano.prioridadeAgendamento && (
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" />
              Prioridade
            </Badge>
          )}
        </CardTitle>
        <p className="pt-2">
          <span className="text-3xl font-bold">{formatBRL(plano.preco)}</span>
          <span className="text-sm text-muted-foreground"> / mês</span>
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {desconto > 0 && (
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{desconto.toFixed(0)}% de desconto em serviços</span>
            </li>
          )}
          {plano.preventivasPorAno > 0 && (
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {plano.preventivasPorAno} visita
                {plano.preventivasPorAno === 1 ? "" : "s"} preventiva
                {plano.preventivasPorAno === 1 ? "" : "s"} por ano
              </span>
            </li>
          )}
          {beneficios.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </>
  );
}
