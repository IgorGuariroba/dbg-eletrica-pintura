"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { iniciarVinculacaoAction, confirmarVinculacaoAction } from "./actions";
import { urlWhatsApp } from "@/lib/contato";
import { useRouter } from "next/navigation";

export function FormularioVinculacao() {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [whatsapp, setWhatsapp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const handleIniciar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const formData = new FormData();
    formData.append("whatsapp", whatsapp);

    const res = await iniciarVinculacaoAction(null, formData);
    setCarregando(false);
    if (res.erro) {
      setErro(res.erro);
    } else if (res.sucesso) {
      setPasso(2);
    }
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const formData = new FormData();
    formData.append("codigo", codigo);

    const res = await confirmarVinculacaoAction(null, formData);
    if (res.erro) {
      setCarregando(false);
      setErro(res.erro);
    } else if (res.sucesso) {
      router.push("/");
      router.refresh();
    }
  };

  const linkAtendimento = urlWhatsApp(
    `Olá! Solicitei a vinculação da minha conta e preciso do código de verificação para o WhatsApp: ${whatsapp}`
  );

  return (
    <div className="w-full max-w-md">
      <Card className="border-border bg-card text-card-foreground shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {passo === 1 ? "Vincular seu WhatsApp" : "Confirmar Código"}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm leading-relaxed">
            {passo === 1
              ? "Para acessar seu portal, informe o número de WhatsApp cadastrado em sua solicitação."
              : "Informe o código de 6 dígitos que você recebeu via WhatsApp."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {erro && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {erro}
            </div>
          )}

          {passo === 1 ? (
            <form onSubmit={handleIniciar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-sm font-semibold text-foreground">
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={carregando}
                  required
                  className="h-10 text-base"
                />
              </div>
              <Button type="submit" className="w-full h-10 font-medium" disabled={carregando}>
                {carregando ? "Enviando..." : "Enviar Código"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleConfirmar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo" className="text-sm font-semibold text-foreground">
                  Código de 6 dígitos
                </Label>
                <Input
                  id="codigo"
                  type="text"
                  placeholder="Digite o código"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={carregando}
                  required
                  className="h-10 text-center text-lg tracking-widest"
                />
              </div>
              <Button type="submit" className="w-full h-10 font-medium" disabled={carregando}>
                {carregando ? "Confirmando..." : "Confirmar Vinculação"}
              </Button>
            </form>
          )}
        </CardContent>
        {passo === 2 && (
          <CardFooter className="flex flex-col gap-3 pt-0 pb-6">
            <div className="text-center text-xs text-muted-foreground leading-relaxed px-4">
              Como estamos em fase de testes, o código deve ser solicitado manualmente ao nosso atendimento.
            </div>
            <a
              href={linkAtendimento}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Falar com Atendimento no WhatsApp
            </a>
            <button
              onClick={() => {
                setPasso(1);
                setErro(null);
                setCodigo("");
              }}
              disabled={carregando}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors mt-2"
            >
              Voltar e alterar número
            </button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
