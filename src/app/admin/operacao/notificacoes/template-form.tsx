"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, salvarVariaveisTemplateAction } from "./actions";

// Rótulos amigáveis das chaves de variável padrão conhecidas.
const ROTULO_VARIAVEL: Record<string, string> = {
  saudacao: "Saudação",
  assinatura: "Assinatura",
  link_base: "Link curto base",
};

function rotularVariavel(chave: string): string {
  return ROTULO_VARIAVEL[chave] ?? chave;
}

export function TemplateForm({
  nome,
  variaveis,
}: {
  nome: string;
  variaveis: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    salvarVariaveisTemplateAction,
    {},
  );
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Variáveis do template salvas");
    }
    if (!state.ok) jaAvisou.current = false;
  }, [state.ok]);

  const chaves = Object.keys(variaveis);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="nome" value={nome} />

      <div className="grid gap-4 sm:grid-cols-2">
        {chaves.map((chave) => (
          <div key={chave} className="space-y-2">
            <Label htmlFor={`${nome}_${chave}`}>{rotularVariavel(chave)}</Label>
            <Input
              id={`${nome}_${chave}`}
              name={`var_${chave}`}
              type="text"
              defaultValue={variaveis[chave]}
            />
          </div>
        ))}
      </div>

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
