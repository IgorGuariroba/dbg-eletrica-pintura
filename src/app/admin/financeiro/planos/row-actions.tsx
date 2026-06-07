"use client";

import { useTransition } from "react";
import type { Route } from "next";
import { CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RowActions } from "../../_components/action-menu";
import { publicarPlanoAction, toggleAtivoPlanoAction } from "./actions";

export function PlanoRowActions({
  id,
  nome,
  ativo,
  publicado,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  publicado: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function publicar() {
    startTransition(async () => {
      const res = await publicarPlanoAction(id);
      if (res.erro) toast.error(res.erro);
      else toast.success("Plano publicado no Mercado Pago");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {!publicado && (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={publicar}
          disabled={pending}
          aria-label={`Publicar ${nome} no Mercado Pago`}
          title="Publicar no Mercado Pago"
        >
          <CloudUpload />
        </Button>
      )}
      <RowActions
        editarHref={`/admin/financeiro/planos/${id}` as Route}
        ativo={ativo}
        nome={nome}
        onToggle={() => toggleAtivoPlanoAction(id)}
        toggleSuccessMsg={(novo) => (novo ? "Plano ativado" : "Plano desativado")}
      />
    </div>
  );
}
