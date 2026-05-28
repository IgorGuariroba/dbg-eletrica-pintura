import Link from "next/link";
import type { Route } from "next";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
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
import { categoriaServicoEnum } from "@/db/schema";
import { exigirCatalogo } from "./guard";
import { ToggleAtivoButton } from "./toggle-button";

type SP = { categoria?: string; ativo?: string; page?: string };

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirCatalogo();
  const sp = await searchParams;

  const categoria = (sp.categoria ?? undefined) as
    | "ELETRICA"
    | "PINTURA"
    | "DRYWALL"
    | undefined;
  const categoriaValida =
    categoria && categoriaServicoEnum.enumValues.includes(categoria)
      ? categoria
      : undefined;
  const ativo =
    sp.ativo === "true" ? true : sp.ativo === "false" ? false : undefined;
  const page = Math.max(Number(sp.page ?? 1), 1);

  const perPage = 20;
  const { itens, total } = await listarServicos(
    { categoria: categoriaValida, ativo, page, perPage },
    criarServicoRepoDrizzle(db),
  );
  const totalPaginas = Math.max(Math.ceil(total / perPage), 1);

  function linkFiltro(over: Partial<SP>): Route {
    const params = new URLSearchParams();
    const merged = { ...sp, ...over };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return `/admin/catalogo?${params.toString()}` as Route;
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {total} serviço{total === 1 ? "" : "s"} cadastrado
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/catalogo/novo" className={buttonVariants()}>
          Novo serviço
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <span className="text-muted-foreground self-center">Categoria:</span>
        <Link
          href={linkFiltro({ categoria: undefined, page: undefined })}
          className={`rounded border px-2 py-1 ${!categoriaValida ? "bg-foreground text-background" : "border-border"}`}
        >
          Todas
        </Link>
        {categoriaServicoEnum.enumValues.map((c) => (
          <Link
            key={c}
            href={linkFiltro({ categoria: c, page: undefined })}
            className={`rounded border px-2 py-1 ${categoriaValida === c ? "bg-foreground text-background" : "border-border"}`}
          >
            {c}
          </Link>
        ))}
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
            <TableHead>Categoria</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Preço base</TableHead>
            <TableHead className="text-right">Garantia (meses)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhum serviço encontrado
              </TableCell>
            </TableRow>
          )}
          {itens.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.nome}</TableCell>
              <TableCell>{s.categoria}</TableCell>
              <TableCell>{s.unidade}</TableCell>
              <TableCell className="text-right">
                R$ {Number(s.precoBase).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">{s.prazoGarantiaMeses}</TableCell>
              <TableCell>
                <Badge variant={s.ativo ? "default" : "secondary"}>
                  {s.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Link
                  href={`/admin/catalogo/${s.id}` as Route}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Editar
                </Link>
                <ToggleAtivoButton id={s.id} ativo={s.ativo} />
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
