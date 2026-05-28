import { exigirCatalogo } from "../guard";
import { ServicoForm } from "../servico-form";
import { criarServicoAction } from "../actions";

export default async function NovoServicoPage() {
  await exigirCatalogo();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Novo serviço</h1>
      <ServicoForm action={criarServicoAction} />
    </div>
  );
}
