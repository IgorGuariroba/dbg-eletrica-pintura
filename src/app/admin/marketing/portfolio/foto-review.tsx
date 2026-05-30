"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { aprovarFotoAction, rejeitarFotoAction } from "./actions";

export function FotoReview({ id }: { id: string }) {
  const [sensivel, setSensivel] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function aprovar() {
    startTransition(async () => {
      const { erro } = await aprovarFotoAction(id, sensivel);
      if (erro) {
        toast.error(erro);
        return;
      }
      toast.success("Foto aprovada e publicada");
    });
  }

  function rejeitar() {
    startTransition(async () => {
      const { erro } = await rejeitarFotoAction(id, motivo);
      if (erro) {
        toast.error(erro);
        return;
      }
      toast.success("Foto rejeitada");
      setRejeitando(false);
      setMotivo("");
    });
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`sensivel-${id}`}
          checked={sensivel}
          onCheckedChange={(v) => setSensivel(v === true)}
        />
        <Label
          htmlFor={`sensivel-${id}`}
          className="text-xs font-normal text-muted-foreground"
        >
          Tem dado sensível (rosto, endereço)
        </Label>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={aprovar}
        >
          <Check className="size-4" aria-hidden />
          Aprovar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => setRejeitando(true)}
        >
          <X className="size-4" aria-hidden />
          Rejeitar
        </Button>
      </div>

      <Dialog open={rejeitando} onOpenChange={setRejeitando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar foto</DialogTitle>
            <DialogDescription>
              A foto não será publicada. O motivo é opcional e fica registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor={`motivo-${id}`}>Motivo (opcional)</Label>
            <Textarea
              id={`motivo-${id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: foto desfocada, rosto do cliente visível"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejeitando(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={rejeitar}
            >
              {pending ? "Rejeitando…" : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
