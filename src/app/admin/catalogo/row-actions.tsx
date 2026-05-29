"use client";

import type { Route } from "next";
import { RowActions } from "../_components/action-menu";
import { toggleAtivoAction } from "./actions";

export function CatalogoRowActions({
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
      editarHref={`/admin/catalogo/${id}` as Route}
      ativo={ativo}
      nome={nome}
      onToggle={() => toggleAtivoAction(id)}
      toggleSuccessMsg={(novo) =>
        novo ? "Serviço ativado" : "Serviço desativado"
      }
    />
  );
}
