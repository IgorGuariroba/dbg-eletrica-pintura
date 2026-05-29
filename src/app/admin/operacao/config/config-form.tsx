"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OperacaoConfig } from "@/operacao/config-repo";
import { type ActionState, salvarConfigAction } from "./actions";

export function ConfigForm({ config }: { config: OperacaoConfig }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarConfigAction,
    {},
  );
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Configuração salva");
    }
    if (!state.ok) jaAvisou.current = false;
  }, [state.ok]);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="precoLitro">Preço do litro (R$)</Label>
          <Input
            id="precoLitro"
            name="precoLitro"
            type="text"
            inputMode="decimal"
            required
            defaultValue={config.precoLitro}
          />
        </div>
        <div>
          <Label htmlFor="kmPorLitro">Km por litro</Label>
          <Input
            id="kmPorLitro"
            name="kmPorLitro"
            type="text"
            inputMode="decimal"
            required
            defaultValue={config.kmPorLitro}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Usados para calcular o deslocamento do orçamento:
        <br />
        <code>(km × preço do litro) ÷ km por litro</code>
      </p>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
