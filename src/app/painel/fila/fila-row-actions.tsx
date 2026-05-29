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
import { devolverOsAction, pegarOsAction } from "./actions";

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : "Não foi possível concluir";
}

export function PegarButton({ osId }: { osId: string }) {
  const [pending, startTransition] = useTransition();

  function pegar() {
    startTransition(async () => {
      try {
        await pegarOsAction(osId);
        toast.success("OS atribuída a você");
      } catch (e) {
        toast.error(mensagemErro(e));
      }
    });
  }

  return (
    <Button type="button" size="sm" disabled={pending} onClick={pegar}>
      {pending ? "Pegando…" : "Pegar"}
    </Button>
  );
}

export function DevolverButton({ osId }: { osId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  function devolver() {
    startTransition(async () => {
      try {
        await devolverOsAction(osId, motivo);
        toast.success("OS devolvida para a fila");
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
        size="sm"
        variant="outline"
        onClick={() => setAberto(true)}
      >
        Devolver
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver OS para a fila</DialogTitle>
          <DialogDescription>
            Conte rapidamente por que está devolvendo. A OS volta a ficar
            disponível para outros técnicos.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-2">
          <Label htmlFor={`motivo-${osId}`}>Motivo</Label>
          <Textarea
            id={`motivo-${osId}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: fora da minha região de atendimento"
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
            disabled={pending || motivo.trim().length < 3}
            onClick={devolver}
          >
            {pending ? "Devolvendo…" : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
