"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleAtivoAction } from "./actions";

export function ToggleAtivoButton({ id, ativo }: { id: string; ativo: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={ativo ? "outline" : "default"}
      disabled={pending}
      onClick={() => startTransition(() => toggleAtivoAction(id))}
    >
      {ativo ? "Desativar" : "Ativar"}
    </Button>
  );
}
