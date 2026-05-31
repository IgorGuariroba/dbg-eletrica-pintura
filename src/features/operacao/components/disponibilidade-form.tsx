"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type ActionState,
  salvarDisponibilidadeTecnicoAction,
} from "@/app/admin/operacao/config/actions";
import type { DisponibilidadeSemanal } from "@/equipe/membro-repo";
import { WeeklyScheduleFields } from "./weekly-schedule-fields";

/**
 * Edita a disponibilidade individual de um técnico. Reutilizado pelo módulo
 * Operação (admin) e pelo perfil do próprio técnico no app de campo — a
 * autorização e a validação ⊆ horário comercial vivem na server action.
 */
export function DisponibilidadeForm({
  tecnicoId,
  disponibilidade,
  onSalvo,
}: {
  tecnicoId: string;
  disponibilidade: DisponibilidadeSemanal | null;
  onSalvo?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarDisponibilidadeTecnicoAction,
    {},
  );
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Disponibilidade salva");
      onSalvo?.();
    }
    if (!state.ok) jaAvisou.current = false;
  }, [state.ok, onSalvo]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tecnicoId" value={tecnicoId} />
      <WeeklyScheduleFields valor={disponibilidade} />

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar disponibilidade"}
      </Button>
    </form>
  );
}
