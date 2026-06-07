"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Plano } from "@/financeiro/planos/plano-repo";
import type { ActionState } from "./actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function PlanoForm({
  action,
  plano,
}: {
  action: Action;
  plano?: Plano;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  const [prioridade, setPrioridade] = useState(
    plano?.prioridadeAgendamento ?? false,
  );
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="nome">Nome do plano</Label>
        <Input id="nome" name="nome" required defaultValue={plano?.nome} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="preco">Preço mensal (R$)</Label>
          <Input
            id="preco"
            name="preco"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={plano?.preco}
          />
        </div>
        <div>
          <Label htmlFor="percentualDesconto">Desconto em orçamentos (%)</Label>
          <Input
            id="percentualDesconto"
            name="percentualDesconto"
            type="text"
            inputMode="decimal"
            placeholder="0"
            required
            defaultValue={plano?.percentualDesconto ?? "0"}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="preventivasPorAno">Preventivas por ano</Label>
          <Input
            id="preventivasPorAno"
            name="preventivasPorAno"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={plano?.preventivasPorAno ?? 0}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="beneficios">Benefícios</Label>
        <Textarea
          id="beneficios"
          name="beneficios"
          rows={4}
          placeholder="Um benefício por linha"
          defaultValue={plano?.beneficios ?? ""}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Cada linha vira um item na página pública e no e-mail de boas-vindas.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="prioridadeAgendamento"
          checked={prioridade}
          onCheckedChange={setPrioridade}
        />
        <Label htmlFor="prioridadeAgendamento">Prioridade no agendamento</Label>
        <input
          type="hidden"
          name="prioridadeAgendamento"
          value={prioridade ? "true" : "false"}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
        <Label htmlFor="ativo">Ativo (visível em /planos)</Label>
        <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />
      </div>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Link
          href={"/admin/financeiro/planos" as Route}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
