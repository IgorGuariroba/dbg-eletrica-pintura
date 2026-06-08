import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { criarChecklistItemRepoDrizzle } from "@/catalogo/checklist-repo-drizzle";
import { db } from "@/db/client";
import { ordemServico } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { ChecklistView } from "@/features/campo/components/checklist-view";

export default async function ChecklistOsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirTecnico();
  const { id } = await params;

  const [os] = await db
    .select({ categoria: ordemServico.categoria })
    .from(ordemServico)
    .where(eq(ordemServico.id, id));
  if (!os) notFound();

  const itens = await criarChecklistItemRepoDrizzle(db).listarPorCategoria(
    os.categoria,
  );

  return (
    <ChecklistView
      osId={id}
      itens={itens.map((i) => ({
        id: i.id,
        descricao: i.descricao,
        exigeFoto: i.exigeFoto,
      }))}
    />
  );
}
