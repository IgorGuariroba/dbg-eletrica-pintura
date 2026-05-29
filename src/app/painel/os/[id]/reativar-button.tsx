"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reativarOsAction } from "./actions";

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : "Não foi possível reativar";
}

export function ReativarButton({ osId }: { osId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function reativar() {
    startTransition(async () => {
      try {
        await reativarOsAction(osId, motivo);
        toast.success("Ordem de Serviço reativada com sucesso!");
        setAberto(false);
        setMotivo("");
      } catch (e) {
        toast.error(mensagemErro(e));
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button
        type="button"
        onClick={() => setAberto(true)}
      >
        Reativar OS
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reativar Ordem de Serviço</DialogTitle>
          <DialogDescription>
            A OS voltará para o estado <strong>ORÇADA</strong> e a validade do
            último orçamento será estendida por 7 dias.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-2">
          <Label htmlFor="motivo-reativacao">Motivo da reativação (opcional)</Label>
          <Textarea
            id="motivo-reativacao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: cliente aceitou fechar com desconto"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAberto(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={reativar}
          >
            {pending ? "Reativando…" : "Confirmar Reativação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
