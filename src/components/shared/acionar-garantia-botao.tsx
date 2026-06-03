"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { AcionarGarantiaDialog } from "./acionar-garantia-dialog";
import { acionarGarantiaPortalAction } from "@/app/portal/os/[id]/actions";

interface AcionarGarantiaBotaoProps {
  osId: string;
}

export function AcionarGarantiaBotao({ osId }: AcionarGarantiaBotaoProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 font-medium cursor-pointer shadow-sm hover:bg-accent flex items-center gap-1.5"
      >
        <ShieldAlert className="size-4 text-amber-500" />
        Acionar Garantia
      </Button>

      <AcionarGarantiaDialog
        osId={osId}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={(descricao, fotoDataUrl) => acionarGarantiaPortalAction(osId, descricao, fotoDataUrl)}
      />
    </>
  );
}
