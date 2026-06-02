import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import type { PagamentoPendente } from "../financeiro";
import { classificarIdadePendencia, rotuloIdadePendencia } from "../idade-pendencia";
import { mensagemLembretePagamento, montarLinkWhatsApp } from "@/lib/whatsapp";

interface PendentesListaProps {
  pendentes: PagamentoPendente[];
  siteUrl: string;
}

export function PendentesLista({ pendentes, siteUrl }: PendentesListaProps) {
  if (pendentes.length === 0) {
    return (
      <Card className="border-dashed flex flex-col items-center justify-center py-10">
        <p className="text-muted-foreground text-sm">Nenhum pagamento pendente.</p>
      </Card>
    );
  }

  function getBadgeConfig(dias: number) {
    const cat = classificarIdadePendencia(dias);
    const label = rotuloIdadePendencia(dias);
    switch (cat) {
      case "novo":
        return { variant: "secondary" as const, label };
      case "1dia":
        return { variant: "outline" as const, label };
      case "3dias":
        return { variant: "warning" as const, label };
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        Pagamentos Pendentes ({pendentes.length})
      </h3>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tempo Pendente</TableHead>
              <TableHead className="text-right">Valor a Cobrar</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendentes.map((p) => {
              const badge = getBadgeConfig(p.diasPendente);
              const valorFormatado = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(parseFloat(p.valor));

              const linkPagar = `${siteUrl}/s/${p.token}/pagar`;
              const textoLembrete = mensagemLembretePagamento({
                clienteNome: p.clienteNome,
                protocolo: p.osId.slice(0, 8).toUpperCase(),
                valor: parseFloat(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                link: linkPagar,
              });
              const linkWa = montarLinkWhatsApp({
                whatsapp: p.clienteWhatsapp,
                texto: textoLembrete,
              });

              return (
                <TableRow key={p.osId}>
                  <TableCell className="font-medium text-foreground">
                    {p.clienteNome}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.categoria}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {valorFormatado}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={linkWa} target="_blank" rel="noopener noreferrer" />}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Lembrete WhatsApp
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-4 grid-cols-1 md:hidden">
        {pendentes.map((p) => {
          const badge = getBadgeConfig(p.diasPendente);
          const valorFormatado = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(parseFloat(p.valor));

          const linkPagar = `${siteUrl}/s/${p.token}/pagar`;
          const textoLembrete = mensagemLembretePagamento({
            clienteNome: p.clienteNome,
            protocolo: p.osId.slice(0, 8).toUpperCase(),
            valor: parseFloat(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            link: linkPagar,
          });
          const linkWa = montarLinkWhatsApp({
            whatsapp: p.clienteWhatsapp,
            texto: textoLembrete,
          });

          return (
            <Card key={p.osId} className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-foreground">
                    {p.clienteNome}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{p.categoria}</Badge>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </div>
                <div className="text-right font-bold text-foreground">
                  {valorFormatado}
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={linkWa} target="_blank" rel="noopener noreferrer" />}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar Lembrete
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
