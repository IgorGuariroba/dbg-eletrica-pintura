"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Loader2, QrCode, Send, Star, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/utils";
import { enviarAssinaturaAction } from "@/app/campo/os/[id]/assinatura/actions";

export interface PlanoOferta {
  slug: string;
  nome: string;
  preco: string;
  percentualDesconto: string;
  preventivasPorAno: number;
  prioridadeAgendamento: boolean;
}

interface Props {
  osId: string;
  clienteNome: string;
  planos: PlanoOferta[];
}

interface Gerado {
  qrDataUrl: string;
  urlWaMe: string;
  urlLanding: string;
}

/**
 * Tela presencial (PWA de campo): o técnico escolhe um plano e gera QR + link
 * wa.me da landing /assinar/{slug}. O cliente assina no próprio aparelho — o
 * técnico nunca toca em dados financeiros. Geração de QR exige rede.
 */
export function AssinaturaPresencialView({ osId, clienteNome, planos }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(
    planos.length === 1 ? planos[0].slug : null,
  );
  const [gerado, setGerado] = useState<Gerado | null>(null);
  const [pending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  function handleEnviar() {
    if (!selecionado) return;
    startTransition(async () => {
      const res = await enviarAssinaturaAction(osId, selecionado);
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      setGerado({
        qrDataUrl: res.qrDataUrl,
        urlWaMe: res.urlWaMe,
        urlLanding: res.urlLanding,
      });
    });
  }

  async function copiarLink() {
    if (!gerado) return;
    await navigator.clipboard.writeText(gerado.urlLanding);
    toast.success("Link copiado!");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Oferecer plano de assinatura</h1>
        <p className="text-sm text-muted-foreground">
          Cliente: {clienteNome}. Escolha um plano e envie para o cliente
          assinar no próprio celular.
        </p>
      </div>

      {planos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum plano disponível</CardTitle>
            <CardDescription>
              Não há planos ativos para oferecer no momento.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {planos.map((p) => {
              const ativo = selecionado === p.slug;
              const desconto = Number(p.percentualDesconto);
              return (
                <Button
                  key={p.slug}
                  type="button"
                  variant={ativo ? "default" : "outline"}
                  onClick={() => setSelecionado(p.slug)}
                  aria-pressed={ativo}
                  className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-semibold">{p.nome}</span>
                    {ativo && <Check className="size-4" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {formatBRL(p.preco)}
                    </span>
                    <span className="text-xs opacity-80">/ mês</span>
                    {p.prioridadeAgendamento && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="size-3" />
                        Prioridade
                      </Badge>
                    )}
                  </div>
                  {desconto > 0 && (
                    <p className="text-sm opacity-80">
                      {desconto.toFixed(0)}% de desconto + {p.preventivasPorAno}{" "}
                      preventiva{p.preventivasPorAno === 1 ? "" : "s"}/ano
                    </p>
                  )}
                </Button>
              );
            })}
          </div>

          {!isOnline ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <WifiOff className="size-5 shrink-0" />
                <span>
                  Sem conexão. A geração do QR de assinatura precisa de internet.
                </span>
              </CardContent>
            </Card>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleEnviar}
              disabled={!selecionado || pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Gerando…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Enviar pro cliente
                </>
              )}
            </Button>
          )}

          {gerado && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pronto para enviar</CardTitle>
                <CardDescription>
                  Mostre o QR ou envie o link. O cliente paga no próprio aparelho.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="qr">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="qr">
                      <QrCode className="size-4" /> QR Code
                    </TabsTrigger>
                    <TabsTrigger value="link">
                      <Send className="size-4" /> Link
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="qr" className="mt-4 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gerado.qrDataUrl}
                      alt="QR Code da assinatura"
                      className="size-56 rounded-lg border border-border"
                    />
                  </TabsContent>
                  <TabsContent value="link" className="mt-4 space-y-3">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={copiarLink}
                    >
                      <Copy className="size-4" /> Copiar link
                    </Button>
                    <a
                      href={gerado.urlWaMe}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "outline",
                        className: "w-full",
                      })}
                    >
                      <ExternalLink className="size-4" /> Enviar por WhatsApp
                    </a>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
