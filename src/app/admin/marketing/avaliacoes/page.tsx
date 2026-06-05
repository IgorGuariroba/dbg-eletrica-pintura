import { Star, MessageSquare } from "lucide-react";
import { db } from "@/db/client";
import { criarAlertaAvaliacaoRepoDrizzle } from "@/marketing/alerta-avaliacao-repo-drizzle";
import { exigirMarketing } from "../guard";
import { EmptyState } from "../../_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatarData(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AvaliacoesQueuePage() {
  await exigirMarketing();

  const pendentes = await criarAlertaAvaliacaoRepoDrizzle(db).listarPendentes();

  // Ordena por data mais recente primeiro
  const itens = [...pendentes].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-sans text-foreground">Tratativas de Avaliações</h1>
        <p className="text-sm text-muted-foreground">
          {itens.length} avaliação{itens.length === 1 ? "" : "ões"} com nota baixa aguardando tratativa.
        </p>
      </div>

      {itens.length === 0 ? (
        <EmptyState
          icon={Star}
          titulo="Nenhum alerta de avaliação"
          descricao="Excelente! Não há avaliações com notas baixas (<= 3) aguardando tratativa no momento."
        />
      ) : (
        <>
          {/* Layout Desktop: Tabela */}
          <div className="hidden md:block border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead className="w-[180px]">Técnico</TableHead>
                  <TableHead className="w-[100px] text-center">Nota</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead className="w-[180px]">ID da OS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((alerta) => (
                  <TableRow key={alerta.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatarData(alerta.criadoEm)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {alerta.tecnicoNome ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive" className="font-semibold gap-1">
                        <Star className="size-3 fill-current" /> {alerta.nota}★
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={alerta.comentarioOs ?? ""}>
                      {alerta.comentarioOs || <span className="italic text-muted-foreground/50">Sem comentário</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[150px]" title={alerta.osId}>
                      {alerta.osId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Layout Mobile: Lista de Cards */}
          <ul className="block md:hidden space-y-4">
            {itens.map((alerta) => (
              <li key={alerta.id}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatarData(alerta.criadoEm)}
                      </span>
                      <Badge variant="destructive" className="font-semibold gap-1">
                        <Star className="size-3 fill-current" /> {alerta.nota}★
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Técnico:</p>
                      <p className="text-sm font-semibold text-foreground">
                        {alerta.tecnicoNome ?? "—"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Comentário:</p>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                        {alerta.comentarioOs || <span className="italic text-muted-foreground/50">Sem comentário</span>}
                      </p>
                    </div>

                    <div className="pt-2 border-t flex justify-between items-center text-xs text-muted-foreground">
                      <span>OS:</span>
                      <span className="font-mono text-[10px] truncate max-w-[180px]" title={alerta.osId}>
                        {alerta.osId}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
