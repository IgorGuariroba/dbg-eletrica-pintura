"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABEL: Record<string, string> = {
  todos: "Todos os status",
  PENDENTE: "Pendente",
  ATIVA: "Ativa",
  PAUSADA: "Pausada",
  CANCELADA: "Cancelada",
  INADIMPLENTE: "Inadimplente",
};

export function FiltrosAssinantes({
  planos,
}: {
  planos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const statusAtual = sp.get("status") ?? "todos";
  const planoAtual = sp.get("plano") ?? "todos";

  function aplicar(chave: "status" | "plano", valor: string) {
    const params = new URLSearchParams(sp.toString());
    if (valor === "todos") params.delete(chave);
    else params.set(chave, valor);
    router.push(
      `/admin/financeiro/assinantes?${params.toString()}` as Route,
    );
  }

  const planoLabel: Record<string, string> = {
    todos: "Todos os planos",
    ...Object.fromEntries(planos.map((p) => [p.id, p.nome])),
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={statusAtual}
        onValueChange={(v) => aplicar("status", String(v))}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue>{(v: string) => STATUS_LABEL[v] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={planoAtual}
        onValueChange={(v) => aplicar("plano", String(v))}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue>{(v: string) => planoLabel[v] ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os planos</SelectItem>
          {planos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
