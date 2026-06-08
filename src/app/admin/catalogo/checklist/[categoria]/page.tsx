import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { criarChecklistItemRepoDrizzle } from "@/catalogo/checklist-repo-drizzle";
import type { Categoria } from "@/catalogo/checklist-repo";
import { db } from "@/db/client";
import { categoriaServicoEnum } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChecklistEditor } from "@/features/catalogo/components/checklist-editor";
import { exigirCatalogo } from "../../guard";

const ROTULO: Record<Categoria, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  await exigirCatalogo();
  const { categoria } = await params;
  const cat = categoria.toUpperCase() as Categoria;
  if (!categoriaServicoEnum.enumValues.includes(cat)) notFound();

  const itens = await criarChecklistItemRepoDrizzle(db).listarPorCategoria(cat);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Checklist Preventivo</h1>
        <p className="text-sm text-muted-foreground">
          Itens de verificação que a equipe segue na OS preventiva, por
          categoria.
        </p>
      </div>

      <nav className="flex gap-2" aria-label="Categorias">
        {categoriaServicoEnum.enumValues.map((c) => (
          <Link
            key={c}
            href={`/admin/catalogo/checklist/${c}` as Route}
            className={cn(
              buttonVariants({
                variant: c === cat ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            {ROTULO[c]}
          </Link>
        ))}
      </nav>

      <ChecklistEditor categoria={cat} itens={itens} />
    </div>
  );
}
