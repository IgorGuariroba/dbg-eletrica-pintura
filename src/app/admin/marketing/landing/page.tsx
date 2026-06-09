import type { Route } from "next";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { db } from "@/db/client";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { listarServicos } from "@/catalogo/listar-servicos";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/utils";
import { exigirMarketing } from "../guard";

export const dynamic = "force-dynamic";

export default async function LandingsPage() {
  await exigirMarketing();

  const { itens } = await listarServicos(
    { ativo: true, perPage: 100 },
    criarServicoRepoDrizzle(db),
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Landing pages</h1>
        <p className="text-sm text-muted-foreground">
          Cada serviço ativo tem uma página pública automática. Personalize o
          conteúdo, preço promocional, fotos e depoimentos.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serviço</TableHead>
            <TableHead>Preço base</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.nome}</TableCell>
              <TableCell>{formatBRL(s.precoBase)}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Link
                  href={`/servicos/${s.slug}` as Route}
                  target="_blank"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <ExternalLink />
                  Ver
                </Link>
                <Link
                  href={`/admin/marketing/landing/${s.slug}` as Route}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil />
                  Personalizar
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
