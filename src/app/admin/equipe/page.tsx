import Link from "next/link";
import type { Route } from "next";
import { listarMembros } from "@/equipe/listar-membros";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { db } from "@/db/client";
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
import type { FiltroPapel } from "@/equipe/membro-repo";
import { exigirEquipe } from "./guard";
import { ToggleAtivoButton } from "./toggle-button";

type SP = { papel?: string; ativo?: string; page?: string };

const PAPEIS: { value: FiltroPapel | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "tecnico", label: "Técnicos" },
  { value: "interno", label: "Internos" },
  { value: "ambos", label: "Compostos" },
];

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

  function linkFiltro(over: Partial<SP>): Route {
    const params = new URLSearchParams();
    const merged = { ...sp, ...over };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return `/admin/equipe?${params.toString()}` as Route;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            {total} membro{total === 1 ? "" : "s"} cadastrado
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/equipe/novo" className={buttonVariants()}>
          Novo membro
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <span className="text-muted-foreground self-center">Papel:</span>
        {PAPEIS.map((p) => {
          const ativoFiltro =
            (p.value === "todos" && !papel) || p.value === papel;
          return (
            <Link
              key={p.value}
              href={linkFiltro({
                papel: p.value === "todos" ? undefined : p.value,
                page: undefined,
              })}
              className={`rounded border px-2 py-1 ${ativoFiltro ? "bg-foreground text-background" : "border-border"}`}
            >
              {p.label}
            </Link>
          );
        })}
        <span className="text-muted-foreground self-center ml-4">Status:</span>
        <Link
          href={linkFiltro({ ativo: undefined, page: undefined })}
          className={`rounded border px-2 py-1 ${ativo === undefined ? "bg-foreground text-background" : "border-border"}`}
        >
          Todos
        </Link>
        <Link
          href={linkFiltro({ ativo: "true", page: undefined })}
          className={`rounded border px-2 py-1 ${ativo === true ? "bg-foreground text-background" : "border-border"}`}
        >
          Ativos
        </Link>
        <Link
          href={linkFiltro({ ativo: "false", page: undefined })}
          className={`rounded border px-2 py-1 ${ativo === false ? "bg-foreground text-background" : "border-border"}`}
        >
          Inativos
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papéis</TableHead>
            <TableHead>Módulos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                Nenhum membro encontrado
              </TableCell>
            </TableRow>
          )}
          {itens.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.nome}</TableCell>
              <TableCell className="text-xs">{m.email}</TableCell>
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
              <TableCell className="text-right space-x-2">
                <Link
                  href={`/admin/equipe/${m.id}` as Route}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Editar
                </Link>
                <ToggleAtivoButton id={m.id} ativo={m.ativo} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={linkFiltro({ page: String(page - 1) })}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Anterior
              </Link>
            )}
            {page < totalPaginas && (
              <Link
                href={linkFiltro({ page: String(page + 1) })}
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
