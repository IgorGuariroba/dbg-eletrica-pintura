import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PagamentoConfirmado } from "../financeiro";

interface ConfirmadosListaProps {
  confirmados: PagamentoConfirmado[];
}

export function ConfirmadosLista({ confirmados }: ConfirmadosListaProps) {
  if (confirmados.length === 0) {
    return (
      <Card className="border-dashed flex flex-col items-center justify-center py-10">
        <p className="text-muted-foreground text-sm">Nenhum pagamento confirmado neste período.</p>
      </Card>
    );
  }

  function getMetodoLabel(metodo: string) {
    switch (metodo.toLowerCase()) {
      case "pix":
        return "Pix";
      case "credit_card":
        return "Cartão de Crédito";
      case "dinheiro":
        return "Dinheiro";
      case "transferencia":
        return "Transferência";
      default:
        return metodo;
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        Pagamentos Confirmados ({confirmados.length})
      </h3>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem de Serviço</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Forma de Pagamento</TableHead>
              <TableHead>Data de Confirmação</TableHead>
              <TableHead className="text-right">Valor Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {confirmados.map((c) => {
              const valorFormatado = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(parseFloat(c.valor));

              const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(c.pagoEm));

              return (
                <TableRow key={c.osId}>
                  <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                    #{c.osId.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {c.clienteNome}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getMetodoLabel(c.metodo)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dataFormatada}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {valorFormatado}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-4 grid-cols-1 md:hidden">
        {confirmados.map((c) => {
          const valorFormatado = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(parseFloat(c.valor));

          const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(c.pagoEm));

          return (
            <Card key={c.osId} className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="space-y-1">
                  <div className="font-mono text-xs text-muted-foreground">
                    #{c.osId.slice(0, 8).toUpperCase()}
                  </div>
                  <CardTitle className="text-base font-bold text-foreground">
                    {c.clienteNome}
                  </CardTitle>
                </div>
                <div className="text-right font-bold text-foreground">
                  {valorFormatado}
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-sm flex items-center justify-between text-muted-foreground">
                <span>{dataFormatada}</span>
                <Badge variant="secondary">{getMetodoLabel(c.metodo)}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
