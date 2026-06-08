import Link from "next/link";
import type { Route } from "next";
import { Layers } from "lucide-react";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exigirFinanceiro } from "../guard";
import { PlanoRowActions } from "./row-actions";
import { EmptyState } from "../../_components/empty-state";

export default async function PlanosPage() {
  await exigirFinanceiro();

  const planos = await criarPlanoRepoDrizzle(db).listarTodos();

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planos de Assinatura</h1>
          <p className="text-sm text-muted-foreground">
            {planos.length} plano{planos.length === 1 ? "" : "s"} cadastrado
            {planos.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={"/admin/financeiro/planos/novo" as Route}
          className={buttonVariants()}
        >
          Novo plano
        </Link>
      </div>

      {planos.length === 0 ? (
        <EmptyState
          icon={Layers}
          titulo="Nenhum plano cadastrado"
          descricao="Crie o primeiro plano para habilitar assinaturas e descontos."
          acao={{
            label: "Novo plano",
            href: "/admin/financeiro/planos/novo" as Route,
          }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Preço mensal</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Preventivas/ano</TableHead>
                <TableHead>Mercado Pago</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    R$ {Number(p.preco).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(p.percentualDesconto).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.preventivasPorAno}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.preapprovalPlanIdMp ? "default" : "secondary"}
                    >
                      {p.preapprovalPlanIdMp ? "Publicado" : "Não publicado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <PlanoRowActions
                      id={p.id}
                      nome={p.nome}
                      ativo={p.ativo}
                      publicado={Boolean(p.preapprovalPlanIdMp)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
