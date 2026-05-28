import { notFound } from "next/navigation";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import { exigirCatalogo } from "../guard";
import { ServicoForm } from "../servico-form";
import { atualizarServicoAction } from "../actions";

export default async function EditarServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirCatalogo();
  const { id } = await params;
  const repo = criarServicoRepoDrizzle(db);
  const servico = await repo.buscarPorId(id);
  if (!servico) notFound();

  const action = atualizarServicoAction.bind(null, id);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Editar serviço</h1>
      <ServicoForm action={action} servico={servico} />
    </div>
  );
}
