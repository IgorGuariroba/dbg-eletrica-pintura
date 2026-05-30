"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, Filter } from "lucide-react";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PAPEIS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "tecnico", label: "Técnicos" },
  { value: "interno", label: "Internos" },
  { value: "ambos", label: "Compostos" },
];

const STATUS: { value: "true" | "false" | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "true", label: "Ativos" },
  { value: "false", label: "Inativos" },
];

export function FiltrosEquipe() {
  const router = useRouter();
  const sp = useSearchParams();

  const papel = sp.get("papel");
  const ativo = sp.get("ativo");

  function aplicar(over: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp);
    Object.entries(over).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    });
    params.delete("page");
    router.push(`/admin/equipe?${params.toString()}` as Route);
  }

  const ativosCount =
    (papel ? 1 : 0) + (ativo === "true" || ativo === "false" ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Filter className="mr-2 size-4" />
            Filtros
            {ativosCount > 0 && (
              <span className="ml-2 rounded-full bg-foreground text-background px-1.5 text-[10px]">
                {ativosCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64 p-3 space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            Papel
          </div>
          <div className="space-y-1">
            {PAPEIS.map((p) => {
              const sel = (p.value === "todos" && !papel) || p.value === papel;
              return (
                <Button
                  key={p.value}
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    aplicar({ papel: p.value === "todos" ? undefined : p.value })
                  }
                  className="h-auto w-full justify-between rounded px-2 py-1.5 text-sm font-normal"
                >
                  {p.label}
                  {sel && <Check className="size-4" />}
                </Button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            Status
          </div>
          <div className="space-y-1">
            {STATUS.map((s) => {
              const sel = (s.value === "todos" && !ativo) || s.value === ativo;
              return (
                <Button
                  key={s.value}
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    aplicar({
                      ativo: s.value === "todos" ? undefined : s.value,
                    })
                  }
                  className="h-auto w-full justify-between rounded px-2 py-1.5 text-sm font-normal"
                >
                  {s.label}
                  {sel && <Check className="size-4" />}
                </Button>
              );
            })}
          </div>
        </div>
        {ativosCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => aplicar({ papel: undefined, ativo: undefined })}
          >
            Limpar filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
