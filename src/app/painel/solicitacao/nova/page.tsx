import type { Metadata } from "next";
import { auth } from "@/auth";
import { autorizarSolicitacaoManual } from "@/operacao/solicitacao-manual";
import { SolicitacaoManualForm } from "./form";

export const metadata: Metadata = {
  title: "Nova solicitação — DBG Painel",
};

export default async function NovaSolicitacaoPage() {
  // Apenas membros com módulo Operação criam solicitações manualmente.
  // Lança ForbiddenError (403) caso contrário — tratado pelo error boundary.
  const session = await auth();
  autorizarSolicitacaoManual(session?.user ?? null);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nova solicitação</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cliente ligou? Registre a solicitação com os mesmos dados do formulário
          público. As OS entram na fila normalmente.
        </p>
      </div>
      <SolicitacaoManualForm />
    </div>
  );
}
