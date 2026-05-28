import { notFound } from "next/navigation";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { db } from "@/db/client";
import { exigirEquipe } from "../guard";
import { MembroForm } from "../membro-form";
import { atualizarMembroAction } from "../actions";

export default async function EditarMembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await exigirEquipe();
  const { id } = await params;
  const repo = criarMembroRepoDrizzle(db);
  const membro = await repo.buscarPorId(id);
  if (!membro) notFound();

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const alvoEhAdminRaiz = adminEmail === membro.email.toLowerCase();
  const editorEhAdminRaiz = session.user.role === "admin_raiz";
  const podeEditar = !alvoEhAdminRaiz || editorEhAdminRaiz;

  const action = atualizarMembroAction.bind(null, id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Editar membro</h1>
      {!podeEditar && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
          Este cadastro pertence ao admin raiz. Apenas ele pode editá-lo.
        </div>
      )}
      <MembroForm action={action} membro={membro} disabled={!podeEditar} />
    </div>
  );
}
