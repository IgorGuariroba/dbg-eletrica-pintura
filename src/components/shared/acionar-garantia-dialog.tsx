"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, X } from "lucide-react";

interface AcionarGarantiaDialogProps {
  osId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (descricao: string, fotoDataUrl: string) => Promise<{ erro?: string }>;
  onSuccess?: () => void;
}

export function AcionarGarantiaDialog({
  osId,
  isOpen,
  onOpenChange,
  onSubmit,
  onSuccess,
}: AcionarGarantiaDialogProps) {
  const [descricao, setDescricao] = React.useState("");
  const [fotoDataUrl, setFotoDataUrl] = React.useState("");
  const [fotoNome, setFotoNome] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDescricao("");
      setFotoDataUrl("");
      setFotoNome("");
    }
    onOpenChange(open);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFotoDataUrl(event.target.result as string);
        setFotoNome(file.name);
      }
    };
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo de imagem.");
    };
    reader.readAsDataURL(file);
  };

  const removeFoto = () => {
    setFotoDataUrl("");
    setFotoNome("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();

    if (descricao.trim().length < 20) {
      toast.error("A descrição deve conter no mínimo 20 caracteres.");
      return;
    }

    if (!fotoDataUrl) {
      toast.error("A foto do problema é obrigatória.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmit(descricao, fotoDataUrl);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Solicitação de garantia enviada com sucesso!");
        handleOpenChange(false);
        onSuccess?.();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao enviar solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  const isValido = descricao.trim().length >= 20 && !!fotoDataUrl;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-6 rounded-xl border bg-background/95 backdrop-blur-md shadow-2xl p-6 transition-all duration-300 ease-in-out">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Solicitar Acionamento de Garantia
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Explique o problema detalhadamente e anexe uma foto legível para análise técnica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmeter} className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="desc-garantia" className="text-sm font-semibold text-foreground">
                Descrição do Problema <span className="text-destructive">*</span>
              </Label>
              <span
                className={`text-xs font-mono transition-colors duration-200 ${
                  descricao.trim().length >= 20
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                }`}
              >
                {descricao.trim().length}/20 carac. mín.
              </span>
            </div>
            <Textarea
              id="desc-garantia"
              placeholder="Descreva o que está ocorrendo, onde está o problema e quando começou (mínimo de 20 caracteres)..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={submitting}
              className="min-h-[110px] resize-none text-base border-input bg-background/50 hover:bg-background/80 focus:bg-background transition-colors duration-200 rounded-lg p-3 leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Foto do Problema <span className="text-destructive">*</span>
            </Label>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={submitting}
            />

            {!fotoDataUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted bg-muted/20 hover:bg-muted/40 active:bg-muted/50 transition-all duration-200 rounded-lg p-6 group cursor-pointer min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="p-3 bg-background rounded-full shadow-sm group-hover:scale-105 transition-transform duration-200 border">
                  <Camera className="size-6 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Clique para tirar ou enviar uma foto</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Formatos aceitos: JPG, PNG, WEBP</p>
                </div>
              </button>
            ) : (
              <div className="relative border rounded-lg overflow-hidden aspect-video bg-muted/10 group flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoDataUrl}
                  alt="Pré-visualização do problema"
                  className="object-contain w-full h-full"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                  <span className="text-xs bg-background/90 text-foreground px-2 py-1 rounded shadow border truncate max-w-[150px] font-mono">
                    {fotoNome}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={removeFoto}
                    disabled={submitting}
                    className="size-8 rounded-full shadow-md cursor-pointer"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full sm:w-auto min-h-[44px] cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValido || submitting}
              className="w-full sm:w-auto font-bold min-h-[44px] shadow-md cursor-pointer transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Solicitação"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
