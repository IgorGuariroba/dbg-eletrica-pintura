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
import { aprovarOsAction, rejeitarOsAction } from "./actions";

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : "Não foi possível concluir";
}

export function AcoesOrcamento({
  token,
  osId,
}: {
  token: string;
  osId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  function aprovar() {
    startTransition(async () => {
      try {
        await aprovarOsAction(token, osId);
        toast.success("Orçamento aprovado! Em breve agendamos o serviço.");
      } catch (e) {
        toast.error(mensagemErro(e));
      }
    });
  }

  function rejeitar() {
    startTransition(async () => {
      try {
        await rejeitarOsAction(token, osId, motivo);
        toast.success("Orçamento recusado.");
        setAberto(false);
        setMotivo("");
      } catch (e) {
        toast.error(mensagemErro(e));
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={pending} onClick={aprovar}>
        {pending ? "Enviando…" : "Aprovar orçamento"}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setAberto(true)}
        >
          Recusar
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar orçamento</DialogTitle>
            <DialogDescription>
              Se quiser, conte rapidamente o motivo — ajuda a gente a melhorar.
              O motivo é opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: preço acima do esperado"
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
            <Button type="button" disabled={pending} onClick={rejeitar}>
              {pending ? "Enviando…" : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
