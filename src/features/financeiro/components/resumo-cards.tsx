import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign } from "lucide-react";
import type { ResumoFinanceiro } from "../financeiro";

interface ResumoCardsProps {
  resumo: ResumoFinanceiro;
}

export function ResumoCards({ resumo }: ResumoCardsProps) {
  const faturamentoFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(parseFloat(resumo.faturamento));

  const ticketMedioFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(parseFloat(resumo.ticketMedio));

  const countText = `${resumo.qtdPagamentos} ${
    resumo.qtdPagamentos === 1 ? "pagamento confirmado" : "pagamentos confirmados"
  }`;

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
      {/* Faturamento (Dominante) */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Faturamento Recebido
          </CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-foreground tracking-tight">
            {faturamentoFormatado}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {countText}
          </p>
        </CardContent>
      </Card>

      {/* Ticket Médio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ticket Médio
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {ticketMedioFormatado}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Média por ordem de serviço paga
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
