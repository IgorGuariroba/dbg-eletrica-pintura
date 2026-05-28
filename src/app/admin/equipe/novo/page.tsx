import { exigirEquipe } from "../guard";
import { MembroForm } from "../membro-form";
import { criarMembroAction } from "../actions";

export default async function NovoMembroPage() {
  await exigirEquipe();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Novo membro</h1>
      <MembroForm action={criarMembroAction} />
    </div>
  );
}
