"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ActionState,
  adicionarBairroAction,
  removerBairroAction,
} from "./actions";

export interface BairroItem {
  id: string;
  nome: string;
}

export function BairrosForm({ bairros }: { bairros: BairroItem[] }) {
  const [state, addAction, pending] = useActionState<ActionState, FormData>(
    adicionarBairroAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Bairro adicionado");
      formRef.current?.reset();
    }
    if (!state.ok) jaAvisou.current = false;
  }, [state.ok]);

  return (
    <div className="space-y-4">
      <form ref={formRef} action={addAction} className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="nome">Bairro atendido</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="Ex.: Vila Mariana"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adicionando…" : "Adicionar"}
        </Button>
      </form>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      {bairros.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum bairro cadastrado ainda.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {bairros.map((b) => (
            <li key={b.id}>
              <form action={removerBairroAction}>
                <input type="hidden" name="id" value={b.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="capitalize"
                >
                  {b.nome}
                  <span aria-hidden className="ml-2 text-muted-foreground">
                    ✕
                  </span>
                  <span className="sr-only">remover {b.nome}</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
