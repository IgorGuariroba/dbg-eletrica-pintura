"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarOsClienteAction } from "../actions";

export function CancelarOsClientForm({
  osId,
  solicitacaoId,
}: {
  osId: string;
  solicitacaoId: string;
}) {
  const router = useRouter();
  const [confirmando, startConfirmar] = useTransition();

  function confirmar() {
    startConfirmar(async () => {
      const res = await cancelarOsClienteAction(osId);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Visita técnica cancelada com sucesso!");
        router.push(`/portal/solicitacao/${solicitacaoId}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="mb-2 font-medium text-foreground">Atenção ao cancelar:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Esta ação é gratuita e liberará o horário para outros clientes.</li>
          <li>Os serviços contratados retornarão para o estado de aprovação original.</li>
          <li>Você poderá agendar uma nova visita a qualquer momento na página do serviço.</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-1/2 cursor-pointer min-h-[44px]"
          onClick={() => router.push(`/portal/solicitacao/${solicitacaoId}`)}
          disabled={confirmando}
        >
          Voltar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="w-full sm:w-1/2 font-bold cursor-pointer min-h-[44px] shadow-sm"
          disabled={confirmando}
          onClick={confirmar}
        >
          {confirmando ? "Cancelando…" : "Confirmar Cancelamento"}
        </Button>
      </div>
    </div>
  );
}
