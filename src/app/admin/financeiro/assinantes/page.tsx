import { Users } from "lucide-react";
import { db } from "@/db/client";
import { criarAssinanteRepoDrizzle } from "@/financeiro/assinantes/assinante-repo-drizzle";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/utils";
import type { StatusAssinatura } from "@/assinatura/assinatura-repo";
import { exigirFinanceiro } from "../guard";
import { FiltrosAssinantes } from "./filtros";
import { EmptyState } from "../../_components/empty-state";

const STATUS_VALIDOS: StatusAssinatura[] = [
  "PENDENTE",
  "ATIVA",
  "PAUSADA",
  "CANCELADA",
  "INADIMPLENTE",
];

const STATUS_LABEL: Record<StatusAssinatura, string> = {
  PENDENTE: "Pendente",
  ATIVA: "Ativa",
  PAUSADA: "Pausada",
  CANCELADA: "Cancelada",
  INADIMPLENTE: "Inadimplente",
};

function statusVariant(
  status: StatusAssinatura,
): "default" | "secondary" | "destructive" {
  if (status === "ATIVA") return "default";
  if (status === "INADIMPLENTE" || status === "CANCELADA") return "destructive";
  return "secondary";
}

function fmtData(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

type SP = { status?: string; plano?: string };

export default async function AssinantesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirFinanceiro();
  const sp = await searchParams;

  const status = STATUS_VALIDOS.includes(sp.status as StatusAssinatura)
    ? (sp.status as StatusAssinatura)
    : undefined;
  const planoId = sp.plano && sp.plano !== "todos" ? sp.plano : undefined;

  const [assinantes, planos] = await Promise.all([
    criarAssinanteRepoDrizzle(db).listarAssinantes({ status, planoId }),
    criarPlanoRepoDrizzle(db).listarTodos(),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assinantes</h1>
        <p className="text-sm text-muted-foreground">
          {assinantes.length} assinante{assinantes.length === 1 ? "" : "s"}
        </p>
      </div>

      <FiltrosAssinantes
        planos={planos.map((p) => ({ id: p.id, nome: p.nome }))}
      />

      {assinantes.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Nenhum assinante encontrado"
          descricao="Ajuste os filtros ou aguarde novas assinaturas."
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor mensal</TableHead>
                  <TableHead>Próxima preventiva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assinantes.map((a) => (
                  <TableRow key={a.assinaturaId}>
                    <TableCell className="font-medium">
                      {a.clienteNome}
                    </TableCell>
                    <TableCell>{a.planoNome}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(a.status)}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(a.valorMensal)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtData(a.proximaPreventiva)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {assinantes.map((a) => (
              <li
                key={a.assinaturaId}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.clienteNome}</span>
                  <Badge variant={statusVariant(a.status)}>
                    {STATUS_LABEL[a.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.planoNome}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums font-medium">
                    {formatBRL(a.valorMensal)}/mês
                  </span>
                  <span className="text-muted-foreground">
                    Preventiva: {fmtData(a.proximaPreventiva)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
