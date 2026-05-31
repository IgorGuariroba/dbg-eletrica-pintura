"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { desvincularGoogleAction } from "./actions";

export function BotaoDesvincular({ whatsapp }: { whatsapp: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDesvincular = async () => {
    setLoading(true);
    try {
      const res = await desvincularGoogleAction(whatsapp);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Vínculo Google removido com sucesso!");
        setOpen(false);
      }
    } catch (err) {
      toast.error("Erro inesperado ao desvincular.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Desvincular Google
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular conta Google?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá a associação entre a conta Google do cliente e o WhatsApp dele.
              O cliente perderá acesso ao portal até realizar uma nova vinculação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDesvincular();
              }}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Desvinculando..." : "Sim, desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
