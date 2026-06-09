"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type ActionState, salvarGatilhoAction } from "./actions";
import type { GatilhoRemarketingId } from "@/marketing/remarketing/gatilhos";

interface RemarketingFormProps {
  gatilho: GatilhoRemarketingId;
  ativoInicial: boolean;
  prazosInicial: number[];
  unidade: "dias" | "horas";
}

export function RemarketingForm({
  gatilho,
  ativoInicial,
  prazosInicial,
  unidade,
}: RemarketingFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarGatilhoAction,
    {},
  );
  const jaAvisou = useRef(false);
  const [ativo, setAtivo] = useState(ativoInicial);
  const [prazos, setPrazos] = useState(prazosInicial);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Configuração de remarketing salva");
    }
    if (state.erro && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.error(state.erro);
    }
  }, [state.ok, state.erro]);

  useEffect(() => {
    jaAvisou.current = false;
  }, [ativo, prazos, state]);

  const handlePrazoChange = (index: number, val: string) => {
    const novo = [...prazos];
    const num = Number(val);
    if (!isNaN(num)) {
      novo[index] = num;
      setPrazos(novo);
    }
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="gatilho" value={gatilho} />
      <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />

      {gatilho !== "validade_orcamento" && (
        <div className="flex items-center space-x-2">
          <Switch
            id={`${gatilho}_ativo`}
            checked={ativo}
            onCheckedChange={setAtivo}
          />
          <Label htmlFor={`${gatilho}_ativo`}>Gatilho Ativo</Label>
        </div>
      )}

      <div className="space-y-3">
        {prazos.map((prazo, idx) => (
          <div key={idx} className="flex flex-col space-y-1.5">
            <Label htmlFor={`${gatilho}_prazo_${idx}`}>
              {prazos.length > 1 ? `Prazo ${idx + 1} (${unidade})` : `Prazo (${unidade})`}
            </Label>
            <Input
              id={`${gatilho}_prazo_${idx}`}
              name={`prazo_${idx}`}
              type="number"
              min={gatilho === "validade_orcamento" ? 1 : 0}
              value={prazo}
              onChange={(e) => handlePrazoChange(idx, e.target.value)}
              className="max-w-[200px]"
              disabled={gatilho !== "validade_orcamento" && !ativo}
            />
          </div>
        ))}
      </div>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Salvando…" : "Salvar Configuração"}
      </Button>
    </form>
  );
}
