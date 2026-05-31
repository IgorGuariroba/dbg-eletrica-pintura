"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeeklyScheduleFields } from "@/features/operacao/components/weekly-schedule-fields";
import type { HorarioComercial } from "@/operacao/horario-comercial";
import { type ActionState, salvarHorarioComercialAction } from "./actions";

export function HorarioComercialForm({
  horario,
}: {
  horario: HorarioComercial;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarHorarioComercialAction,
    {},
  );
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Horário comercial salvo");
    }
    if (!state.ok) jaAvisou.current = false;
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-4">
      <WeeklyScheduleFields valor={horario} />

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar horário"}
      </Button>
    </form>
  );
}
