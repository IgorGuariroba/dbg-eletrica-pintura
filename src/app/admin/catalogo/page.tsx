import Link from "next/link";
import type { Route } from "next";
import { Boxes } from "lucide-react";
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
import { CatalogoRowActions } from "./row-actions";
import { FiltrosCatalogo } from "./filtros";
import { EmptyState } from "../_components/empty-state";

type SP = { categoria?: string; ativo?: string; page?: string };

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirCatalogo();
  const sp = await searchParams;

  const categoria = sp.categoria as
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
  const temFiltros = categoriaValida || ativo !== undefined;

  function paginaHref(p: number): Route {
    const params = new URLSearchParams();
    if (categoriaValida) params.set("categoria", categoriaValida);
    if (ativo !== undefined) params.set("ativo", String(ativo));
    if (p > 1) params.set("page", String(p));
    return `/admin/catalogo${params.size ? `?${params}` : ""}` as Route;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {total} serviço{total === 1 ? "" : "s"}{" "}
            {temFiltros ? "encontrado" : "cadastrado"}
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={"/admin/catalogo/checklist/ELETRICA" as Route}
            className={buttonVariants({ variant: "outline" })}
          >
            Checklist preventivo
          </Link>
          <Link href="/admin/catalogo/novo" className={buttonVariants()}>
            Novo serviço
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <FiltrosCatalogo />
      </div>

      {itens.length === 0 ? (
        temFiltros ? (
          <EmptyState
            icon={Boxes}
            titulo="Nenhum serviço encontrado"
            descricao="Tente ajustar os filtros ou limpar para ver tudo."
          />
        ) : (
          <EmptyState
            icon={Boxes}
            titulo="Catálogo vazio"
            descricao="Cadastre o primeiro serviço para liberar o orçamento da equipe."
            acao={{ label: "Novo serviço", href: "/admin/catalogo/novo" }}
          />
        )
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Preço base</TableHead>
                <TableHead className="text-right">Garantia (meses)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{s.categoria}</TableCell>
                  <TableCell>{s.unidade}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    R$ {Number(s.precoBase).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.prazoGarantiaMeses}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.ativo ? "default" : "secondary"}>
                      {s.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CatalogoRowActions id={s.id} nome={s.nome} ativo={s.ativo} />
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
