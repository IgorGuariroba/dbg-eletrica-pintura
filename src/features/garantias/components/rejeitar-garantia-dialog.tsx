"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { rejeitarGarantiaAction } from "@/app/admin/garantias/actions";
import type { ChamadoPendenteLista } from "@/operacao/garantia/aplicar-garantia";

interface RejeitarGarantiaDialogProps {
  chamado: ChamadoPendenteLista | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RejeitarGarantiaDialog({
  chamado,
  isOpen,
  onClose,
  onSuccess,
}: RejeitarGarantiaDialogProps) {
  const [motivo, setMotivo] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!chamado) return null;

  const handleConfirm = async () => {
    if (!motivo.trim()) {
      toast.error("Você deve preencher o motivo da rejeição.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await rejeitarGarantiaAction(chamado.id, motivo.trim());

      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Chamado de garantia rejeitado com sucesso.");
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao rejeitar a garantia.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Rejeitar Chamado de Garantia
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Tem certeza que deseja rejeitar o acionamento de garantia de{" "}
            <strong>{chamado.cliente.nome}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 my-2">
          <Label htmlFor="motivo" className="text-sm font-semibold text-foreground">
            Motivo da Rejeição (obrigatório)
          </Label>
          <Textarea
            id="motivo"
            placeholder="Ex: Problema causado por uso inadequado do cliente ou instalação pós-serviço que danificou o circuito."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="min-h-[100px] text-sm bg-background border-input focus-visible:ring-ring"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="border-border hover:bg-muted font-semibold"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !motivo.trim()}
            className="font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejeitando...
              </>
            ) : (
              "Rejeitar Chamado"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
