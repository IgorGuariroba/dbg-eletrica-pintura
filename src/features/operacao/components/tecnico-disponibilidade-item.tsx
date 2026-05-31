"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DisponibilidadeSemanal } from "@/equipe/membro-repo";
import { DisponibilidadeForm } from "./disponibilidade-form";

/**
 * Linha compacta de um técnico na configuração de Operação: nome + botão que
 * abre um diálogo com o editor de disponibilidade. Mantém a lista enxuta mesmo
 * com dezenas de técnicos (evita renderizar todas as grades semanais inline).
 */
export function TecnicoDisponibilidadeItem({
  tecnicoId,
  nome,
  disponibilidade,
}: {
  tecnicoId: string;
  nome: string;
  disponibilidade: DisponibilidadeSemanal | null;
}) {
  const [aberto, setAberto] = useState(false);
  const diasAtivos = disponibilidade
    ? Object.values(disponibilidade).filter(Boolean).length
    : 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <div>
        <p className="font-medium">{nome}</p>
        <p className="text-sm text-muted-foreground">
          {diasAtivos > 0
            ? `${diasAtivos} dia(s) disponível(is)`
            : "Sem disponibilidade definida"}
        </p>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Editar
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Disponibilidade — {nome}</DialogTitle>
            <DialogDescription>
              Janelas dentro do horário comercial. Fora do range, o salvamento é
              recusado.
            </DialogDescription>
          </DialogHeader>
          <DisponibilidadeForm
            tecnicoId={tecnicoId}
            disponibilidade={disponibilidade}
            onSalvo={() => setAberto(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
