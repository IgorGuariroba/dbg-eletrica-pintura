import Link from "next/link";
import type { Route } from "next";
import { Users } from "lucide-react";
import { listarMembros } from "@/equipe/listar-membros";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { db } from "@/db/client";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FiltroPapel } from "@/equipe/membro-repo";
import { exigirEquipe } from "./guard";
import { EquipeRowActions } from "./row-actions";
import { FiltrosEquipe } from "./filtros";
import { EmptyState } from "../_components/empty-state";

type SP = { papel?: string; ativo?: string; page?: string };

function iniciais(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirEquipe();
  const sp = await searchParams;

  const papel =
    sp.papel === "tecnico" || sp.papel === "interno" || sp.papel === "ambos"
      ? (sp.papel as FiltroPapel)
      : undefined;
  const ativo =
    sp.ativo === "true" ? true : sp.ativo === "false" ? false : undefined;
  const page = Math.max(Number(sp.page ?? 1), 1);
  const perPage = 20;

  const { itens, total } = await listarMembros(
    { papel, ativo, page, perPage },
    criarMembroRepoDrizzle(db),
  );
  const totalPaginas = Math.max(Math.ceil(total / perPage), 1);
  const temFiltros = papel !== undefined || ativo !== undefined;

  function paginaHref(p: number): Route {
    const params = new URLSearchParams();
    if (papel) params.set("papel", papel);
    if (ativo !== undefined) params.set("ativo", String(ativo));
    if (p > 1) params.set("page", String(p));
    return `/admin/equipe${params.size ? `?${params}` : ""}` as Route;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            {total} membro{total === 1 ? "" : "s"}{" "}
            {temFiltros ? "encontrado" : "cadastrado"}
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/equipe/novo" className={buttonVariants()}>
          Novo membro
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <FiltrosEquipe />
      </div>

      {itens.length === 0 ? (
        temFiltros ? (
          <EmptyState
            icon={Users}
            titulo="Nenhum membro encontrado"
            descricao="Tente ajustar os filtros ou limpar para ver todos."
          />
        ) : (
          <EmptyState
            icon={Users}
            titulo="Equipe vazia"
            descricao="Cadastre o primeiro membro interno ou técnico para começar."
            acao={{ label: "Novo membro", href: "/admin/equipe/novo" }}
          />
        )
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {m.fotoUrl && (
                          <AvatarImage src={m.fotoUrl} alt={m.nome} />
                        )}
                        <AvatarFallback>{iniciais(m.nome)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{m.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {m.isTecnico && <Badge variant="default">Técnico</Badge>}
                    {m.modulos.length > 0 && (
                      <Badge variant="secondary">Interno</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.modulos.join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.ativo ? "default" : "secondary"}>
                      {m.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EquipeRowActions id={m.id} nome={m.nome} ativo={m.ativo} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={paginaHref(page - 1)}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Anterior
              </Link>
            )}
            {page < totalPaginas && (
              <Link
                href={paginaHref(page + 1)}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
