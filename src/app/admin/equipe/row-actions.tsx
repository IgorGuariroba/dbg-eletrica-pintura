"use client";

import type { Route } from "next";
import { RowActions } from "../_components/action-menu";
import { toggleAtivoMembroAction } from "./actions";

export function EquipeRowActions({
  id,
  nome,
  ativo,
}: {
  id: string;
  nome: string;
  ativo: boolean;
}) {
  return (
    <RowActions
      editarHref={`/admin/equipe/${id}` as Route}
      ativo={ativo}
      nome={nome}
      onToggle={() => toggleAtivoMembroAction(id)}
      toggleSuccessMsg={(novo) => (novo ? "Membro ativado" : "Membro desativado")}
    />
  );
}
