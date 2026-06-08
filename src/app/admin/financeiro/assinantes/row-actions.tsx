"use client";

import { useTransition } from "react";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pausarAssinanteAction } from "./actions";

/**
 * Ação de pausa do assinante (admin Financeiro). Só faz sentido para assinatura
 * ATIVA com preapproval no MP — fora disso o botão não é renderizado.
 */
export function AssinanteRowActions({
  preapprovalIdMp,
  clienteNome,
}: {
  preapprovalIdMp: string;
  clienteNome: string;
}) {
  const [pending, startTransition] = useTransition();

  function pausar() {
    startTransition(async () => {
      const res = await pausarAssinanteAction(preapprovalIdMp);
      if (res.erro) toast.error(res.erro);
      else toast.success(`Assinatura de ${clienteNome} pausada`);
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={pausar}
      disabled={pending}
      aria-label={`Pausar assinatura de ${clienteNome}`}
    >
      <PauseCircle className="size-4" />
      Pausar
    </Button>
  );
}
