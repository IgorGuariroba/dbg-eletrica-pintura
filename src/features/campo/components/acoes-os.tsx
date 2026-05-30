"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelarAction,
  marcarAguardandoAction,
  reagendarAction,
} from "@/app/campo/os/[id]/acoes";

// Estados a partir dos quais o técnico pode reagendar/cancelar.
const REAGENDAVEIS = new Set(["AGENDADA", "A_CAMINHO", "NO_LOCAL"]);

export function AcoesOs({
  osId,
  estado,
  onConcluido,
}: {
  osId: string;
  estado: string;
  onConcluido?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [reabrir, setReabrir] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [slot, setSlot] = useState("");
  const [motivoReag, setMotivoReag] = useState("");
  const [motivoCanc, setMotivoCanc] = useState("");

  const motivoObrigatorio = estado === "A_CAMINHO" || estado === "NO_LOCAL";

  function submeterReagendar() {
    startTransition(async () => {
      const form = new FormData();
      form.append("osId", osId);
      form.append("slot", slot);
      form.append("motivo", motivoReag);
      const res = await reagendarAction({}, form);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Visita reagendada");
      setReabrir(false);
      setSlot("");
      setMotivoReag("");
      onConcluido?.();
    });
  }

  function submeterCancelar() {
    startTransition(async () => {
      const form = new FormData();
      form.append("osId", osId);
      form.append("motivo", motivoCanc);
      const res = await cancelarAction({}, form);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("OS cancelada e devolvida à fila");
      setCancelar(false);
      setMotivoCanc("");
      onConcluido?.();
    });
  }

  function marcarAguardando() {
    startTransition(async () => {
      const form = new FormData();
      form.append("osId", osId);
      const res = await marcarAguardandoAction({}, form);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("OS marcada como aguardando complementar");
      onConcluido?.();
    });
  }

  // EM_EXECUÇÃO: não cancela — cria complementar ou marca aguardando.
  if (estado === "EM_EXECUCAO") {
    return (
      <div className="space-y-2">
        <Link
          href={`/campo/os/${osId}/complementar/nova` as Route}
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          <Plus className="size-4" aria-hidden />
          Criar orçamento complementar
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={marcarAguardando}
        >
          Marcar como aguardando complementar
        </Button>
      </div>
    );
  }

  if (!REAGENDAVEIS.has(estado)) return null;

  return (
    <div className="flex gap-2">
      {/* Reagendar */}
      <Dialog open={reabrir} onOpenChange={setReabrir}>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setReabrir(true)}
        >
          <CalendarClock className="size-4" aria-hidden />
          Reagendar
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar visita</DialogTitle>
            <DialogDescription>
              Escolha a nova data e horário.
              {motivoObrigatorio
                ? " Informe o motivo (mínimo 10 caracteres)."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slot">Nova data e horário</Label>
              <Input
                id="slot"
                type="datetime-local"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo-reag">
                Motivo {motivoObrigatorio ? "(obrigatório)" : "(opcional)"}
              </Label>
              <Textarea
                id="motivo-reag"
                value={motivoReag}
                onChange={(e) => setMotivoReag(e.target.value)}
                placeholder="Ex.: cliente pediu para remarcar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setReabrir(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={pending || !slot}
              onClick={submeterReagendar}
            >
              {pending ? "Reagendando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={cancelar} onOpenChange={setCancelar}>
        <Button
          type="button"
          variant="outline"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={() => setCancelar(true)}
        >
          <X className="size-4" aria-hidden />
          Cancelar
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar OS</DialogTitle>
            <DialogDescription>
              A OS volta para a fila para reatribuição. Informe o motivo (mínimo
              10 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="motivo-canc">Motivo do cancelamento</Label>
            <Textarea
              id="motivo-canc"
              value={motivoCanc}
              onChange={(e) => setMotivoCanc(e.target.value)}
              placeholder="Ex.: imprevisto, não consegui chegar ao local"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCancelar(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || motivoCanc.trim().length < 10}
              onClick={submeterCancelar}
            >
              {pending ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
