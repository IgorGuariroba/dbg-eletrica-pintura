import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { exigirFinanceiro } from "../../guard";
import { PlanoForm } from "../plano-form";
import { atualizarPlanoAction } from "../actions";

export default async function EditarPlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirFinanceiro();
  const { id } = await params;
  const plano = await criarPlanoRepoDrizzle(db).buscarPorId(id);
  if (!plano) notFound();

  const action = atualizarPlanoAction.bind(null, id);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Editar plano</h1>
      <PlanoForm action={action} plano={plano} />
    </div>
  );
}
