import { exigirFinanceiro } from "../../guard";
import { PlanoForm } from "../plano-form";
import { criarPlanoAction } from "../actions";

export default async function NovoPlanoPage() {
  await exigirFinanceiro();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Novo plano</h1>
      <PlanoForm action={criarPlanoAction} />
    </div>
  );
}
