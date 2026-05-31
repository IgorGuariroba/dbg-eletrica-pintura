"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DiaSemana, HorarioComercial } from "@/operacao/horario-comercial";

const DIAS: { chave: DiaSemana; rotulo: string }[] = [
  { chave: "seg", rotulo: "Segunda" },
  { chave: "ter", rotulo: "Terça" },
  { chave: "qua", rotulo: "Quarta" },
  { chave: "qui", rotulo: "Quinta" },
  { chave: "sex", rotulo: "Sexta" },
  { chave: "sab", rotulo: "Sábado" },
  { chave: "dom", rotulo: "Domingo" },
];

interface LinhaDia {
  aberto: boolean;
  inicio: string;
  fim: string;
}

function estadoInicial(valor: HorarioComercial | null | undefined) {
  const base = {} as Record<DiaSemana, LinhaDia>;
  for (const { chave } of DIAS) {
    const janela = valor?.[chave];
    base[chave] = {
      aberto: Boolean(janela),
      inicio: janela?.inicio ?? "08:00",
      fim: janela?.fim ?? "18:00",
    };
  }
  return base;
}

/**
 * Grade semanal reutilizável (horário comercial e disponibilidade do técnico):
 * por dia, um switch aberto/fechado e dois horários. Emite os campos
 * `${dia}_aberto`, `${dia}_inicio` e `${dia}_fim` no FormData do `<form>` pai.
 */
export function WeeklyScheduleFields({
  valor,
}: {
  valor?: HorarioComercial | null;
}) {
  const [dias, setDias] = useState(() => estadoInicial(valor));

  function patch(chave: DiaSemana, mudanca: Partial<LinhaDia>) {
    setDias((atual) => ({ ...atual, [chave]: { ...atual[chave], ...mudanca } }));
  }

  return (
    <div className="space-y-3">
      {DIAS.map(({ chave, rotulo }) => {
        const linha = dias[chave];
        return (
          <div
            key={chave}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
          >
            <div className="flex min-w-32 items-center gap-3">
              <Switch
                id={`${chave}_aberto`}
                name={linha.aberto ? `${chave}_aberto` : undefined}
                checked={linha.aberto}
                onCheckedChange={(aberto) => patch(chave, { aberto })}
              />
              <Label htmlFor={`${chave}_aberto`} className="font-medium">
                {rotulo}
              </Label>
            </div>

            {linha.aberto ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${rotulo} — abre`}
                  name={`${chave}_inicio`}
                  value={linha.inicio}
                  onChange={(e) => patch(chave, { inicio: e.target.value })}
                  className="w-32"
                  required
                />
                <span className="text-muted-foreground">às</span>
                <Input
                  type="time"
                  aria-label={`${rotulo} — fecha`}
                  name={`${chave}_fim`}
                  value={linha.fim}
                  onChange={(e) => patch(chave, { fim: e.target.value })}
                  className="w-32"
                  required
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
