"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type ActionState, salvarConfigReferralAction } from "./actions";

interface ReferralFormProps {
  ativoInicial: boolean;
  valorPremioInicial: string;
}

export function ReferralForm({
  ativoInicial,
  valorPremioInicial,
}: ReferralFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarConfigReferralAction,
    {},
  );
  const jaAvisou = useRef(false);
  const [ativo, setAtivo] = useState(ativoInicial);
  const [valorPremio, setValorPremio] = useState(valorPremioInicial);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Configuração do programa de indicação salva");
    }
    if (state.erro && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.error(state.erro);
    }
  }, [state.ok, state.erro]);

  useEffect(() => {
    jaAvisou.current = false;
  }, [ativo, valorPremio, state]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />

      <div className="flex items-center space-x-2">
        <Switch
          id="referral_ativo"
          checked={ativo}
          onCheckedChange={setAtivo}
        />
        <Label htmlFor="referral_ativo" className="cursor-pointer">Programa Ativo</Label>
      </div>

      <div className="flex flex-col space-y-1.5">
        <Label htmlFor="referral_valor_premio">
          Valor do Prêmio/Desconto (R$)
        </Label>
        <Input
          id="referral_valor_premio"
          name="valorPremio"
          type="number"
          step="0.01"
          min="0"
          value={valorPremio}
          onChange={(e) => setValorPremio(e.target.value)}
          className="max-w-[200px]"
          disabled={!ativo}
        />
        <p className="text-xs text-muted-foreground">
          Valor concedido como desconto para o indicado (na 1ª OS) e como crédito para o indicador (padrinho).
        </p>
      </div>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar Configuração"}
      </Button>
    </form>
  );
}
