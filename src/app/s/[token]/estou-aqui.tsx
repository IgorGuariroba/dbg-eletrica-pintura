"use client";

import { useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão de confirmação de presença no link público (sem login). Idempotente no
 * servidor; aqui só reflete o resultado.
 */
export function EstouAqui({ token, osId }: { token: string; osId: string }) {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "confirmado">(
    "inicial",
  );

  async function confirmar() {
    setEstado("enviando");
    try {
      const res = await fetch(`/s/${token}/presenca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ osId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEstado("confirmado");
    } catch {
      setEstado("inicial");
    }
  }

  if (estado === "confirmado") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Check className="size-4" aria-hidden />
        Presença confirmada — o técnico já sabe que você está aí.
      </p>
    );
  }

  return (
    <Button
      className="w-full"
      size="lg"
      disabled={estado === "enviando"}
      onClick={confirmar}
    >
      {estado === "enviando" ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <MapPin className="size-4" aria-hidden />
      )}
      Estou aqui
    </Button>
  );
}
