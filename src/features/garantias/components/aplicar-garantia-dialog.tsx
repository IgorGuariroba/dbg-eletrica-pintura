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
import { Loader2, Wrench, AlertTriangle } from "lucide-react";
import { aplicarGarantiaAction } from "@/app/admin/garantias/actions";
import type { ChamadoPendenteLista } from "@/operacao/garantia/aplicar-garantia";

interface AplicarGarantiaDialogProps {
  chamado: ChamadoPendenteLista | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AplicarGarantiaDialog({
  chamado,
  isOpen,
  onClose,
  onSuccess,
}: AplicarGarantiaDialogProps) {
  const [justificativa, setJustificativa] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!chamado) return null;

  const isForaPrazo = chamado.prazo.dentroDoPrazo === false;

  const handleConfirm = async () => {
    if (isForaPrazo && !justificativa.trim()) {
      toast.error("Você deve preencher a justificativa de override.");
      return;
    }

    setSubmitting(true);
    try {
      const override = isForaPrazo
        ? { justificativa: justificativa.trim() }
        : null;

      const res = await aplicarGarantiaAction(chamado.id, override);

      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Garantia aplicada e OS criada com sucesso!");
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aplicar a garantia.");
    } finally {
      setSubmitting(false);
    }
  };

  // Determine technician message
  const getTecnicoMessage = () => {
    if (chamado.tecnicoOriginal?.nome) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/10">
          <Wrench className="h-4 w-4 text-primary shrink-0" />
          <span>
            A nova OS será atribuída ao técnico original:{" "}
            <strong className="text-foreground font-semibold">
              {chamado.tecnicoOriginal.nome}
            </strong>.
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-500/5 p-3 rounded-md border border-amber-500/10">
        <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
        <span>
          Nenhum técnico original atribuído ou disponível. A nova OS irá para a{" "}
          <strong className="text-foreground font-semibold">Fila Geral</strong> de atendimento.
        </span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Aprovar Chamado de Garantia
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Confirme a abertura da Ordem de Serviço de Garantia para{" "}
            <strong>{chamado.cliente.nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 my-3">
          {getTecnicoMessage()}

          {isForaPrazo && (
            <div className="flex flex-col gap-2.5 p-3 rounded-md bg-destructive/5 border border-destructive/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Override de Prazo Necessário</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este chamado está fora do prazo de garantia de mão de obra. É obrigatório registrar uma justificativa para abrir esta garantia em caráter excepcional.
              </p>
              <div className="flex flex-col gap-1.5 mt-1.5">
                <Label htmlFor="justificativa" className="text-xs font-semibold text-foreground">
                  Justificativa do Administrador
                </Label>
                <Textarea
                  id="justificativa"
                  placeholder="Ex: Cliente antigo, o atraso foi de apenas 2 dias e houve falha de comunicação prévia."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="min-h-[80px] text-sm bg-background border-input focus-visible:ring-ring"
                />
              </div>
            </div>
          )}
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
            onClick={handleConfirm}
            disabled={submitting || (isForaPrazo && !justificativa.trim())}
            className="font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aprovando...
              </>
            ) : (
              "Aprovar e Criar OS"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
