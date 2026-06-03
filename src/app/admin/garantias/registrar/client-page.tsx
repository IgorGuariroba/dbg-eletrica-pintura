"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, X, ArrowLeft } from "lucide-react";
import { registrarAcionamentoGarantiaAction } from "../actions";

export default function RegistrarGarantiaClientPage() {
  const router = useRouter();
  const [osId, setOsId] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [fotoDataUrl, setFotoDataUrl] = React.useState("");
  const [fotoNome, setFotoNome] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!osId.trim()) {
      toast.error("O ID da OS é obrigatório.");
      return;
    }

    if (!whatsapp.trim()) {
      toast.error("O WhatsApp do cliente é obrigatório.");
      return;
    }

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
      const res = await registrarAcionamentoGarantiaAction(osId.trim(), whatsapp.trim(), descricao, fotoDataUrl);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Acionamento de garantia registrado com sucesso!");
        // Limpar o formulário
        setOsId("");
        setWhatsapp("");
        setDescricao("");
        removeFoto();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar o acionamento de garantia.");
    } finally {
      setSubmitting(false);
    }
  };

  const isValido = !!osId.trim() && !!whatsapp.trim() && descricao.trim().length >= 20 && !!fotoDataUrl;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="size-9 p-0 rounded-full cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Garantias</h1>
          <p className="text-sm text-muted-foreground">Módulo administrativo de suporte</p>
        </div>
      </div>

      <Card className="shadow-lg border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Registrar Chamado (WhatsApp)</CardTitle>
          <CardDescription>
            Insira os dados do acionamento recebido por atendimento humano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="os-id" className="text-sm font-semibold">
                  ID da OS <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="os-id"
                  placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                  value={osId}
                  onChange={(e) => setOsId(e.target.value)}
                  disabled={submitting}
                  className="bg-background/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-sm font-semibold">
                  WhatsApp do Cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="whatsapp"
                  placeholder="Ex: 5511999999999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={submitting}
                  className="bg-background/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="descricao" className="text-sm font-semibold">
                  Descrição do Relato <span className="text-destructive">*</span>
                </Label>
                <span
                  className={`text-xs font-mono transition-colors ${
                    descricao.trim().length >= 20 ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {descricao.trim().length}/20 carac. mín.
                </span>
              </div>
              <Textarea
                id="descricao"
                placeholder="Relato completo do cliente enviado via WhatsApp (mínimo de 20 caracteres)..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={submitting}
                className="min-h-32 resize-none bg-background/50 focus:bg-background transition-colors leading-relaxed"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                Foto Anexa <span className="text-destructive">*</span>
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
                  className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted bg-muted/10 hover:bg-muted/30 transition-all rounded-lg p-6 cursor-pointer min-h-32 group focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="p-3 bg-background rounded-full shadow-sm group-hover:scale-105 transition-transform duration-200 border">
                    <Camera className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Carregar imagem enviada pelo cliente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WEBP</p>
                  </div>
                </button>
              ) : (
                <div className="relative border rounded-lg overflow-hidden aspect-video bg-muted/5 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoDataUrl}
                    alt="Foto do acionamento"
                    className="object-contain w-full h-full"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="text-xs bg-background/90 text-foreground px-2 py-1 rounded shadow border truncate max-w-36 font-mono">
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

            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="submit"
                disabled={!isValido || submitting}
                className="w-full sm:w-auto font-bold min-h-11 cursor-pointer shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar Acionamento"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
