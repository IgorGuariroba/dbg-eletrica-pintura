"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Check, Loader2, MapPin, MessageCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AcoesOs } from "@/features/campo/components/acoes-os";
import { getCampoDb } from "@/features/campo/db";
import { enfileirarTransicao } from "@/features/campo/execucao-repo";
import { obterLocalizacao } from "@/features/campo/geo";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";
import { mensagemACaminho, montarLinkWhatsApp } from "@/lib/whatsapp";

interface Complementar {
  id: string;
  estado: string;
  categoria: string;
}

interface Detalhe {
  estado: string;
  clienteNome: string;
  whatsapp: string;
  endereco: string;
  tecnicoNome: string;
  presencaConfirmada: boolean;
  complementares: Complementar[];
}

export function RastreamentoView({ osId }: { osId: string }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [transitando, setTransitando] = useState(false);

  async function carregar() {
    try {
      const res = await fetch(`/api/campo/os/${osId}`);
      if (res.ok) setDetalhe((await res.json()) as Detalhe);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osId]);

  async function transitar(alvo: "A_CAMINHO" | "NO_LOCAL") {
    setTransitando(true);
    const geo = await obterLocalizacao();
    try {
      const res = await fetch(`/api/campo/os/${osId}/transicao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alvo, lat: geo?.lat, lon: geo?.lon }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { estado } = (await res.json()) as { estado: string };
      setDetalhe((d) => (d ? { ...d, estado } : d));
      toast.success(
        alvo === "A_CAMINHO" ? "Marcado a caminho" : "Chegada registrada",
      );
    } catch {
      // Offline: enfileira local e atualiza o estado otimisticamente; o slice 9
      // drena a fila quando o sinal voltar.
      await enfileirarTransicao(getCampoDb(), {
        osId,
        alvo,
        lat: geo?.lat,
        lon: geo?.lon,
      });
      setDetalhe((d) => (d ? { ...d, estado: alvo } : d));
      toast.message("Sem sinal — registrado e será sincronizado depois");
    } finally {
      setTransitando(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!detalhe) {
    return (
      <p className="py-12 text-center text-base text-muted-foreground">
        Não foi possível carregar a OS.
      </p>
    );
  }

  const podeACaminho =
    detalhe.estado === "APROVADA" || detalhe.estado === "AGENDADA";
  const podeCheguei = detalhe.estado === "A_CAMINHO";
  const linkWhats = montarLinkWhatsApp({
    whatsapp: detalhe.whatsapp,
    texto: mensagemACaminho({
      clienteNome: detalhe.clienteNome.split(" ")[0],
      tecnicoNome: detalhe.tecnicoNome.split(" ")[0],
      endereco: detalhe.endereco,
    }),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">{detalhe.clienteNome}</h1>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {detalhe.endereco}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Rastreamento</CardTitle>
            <Badge variant="secondary">
              {rotularEstadoCliente(detalhe.estado)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {podeCheguei &&
            (detalhe.presencaConfirmada ? (
              <Badge variant="default" className="gap-1">
                <Check className="size-3" aria-hidden />
                Cliente confirmou presença
              </Badge>
            ) : (
              <Badge variant="secondary">Aguardando confirmação</Badge>
            ))}

          {podeACaminho && (
            <Button
              className="w-full"
              size="lg"
              disabled={transitando}
              onClick={() => transitar("A_CAMINHO")}
            >
              {transitando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Navigation className="size-4" aria-hidden />
              )}
              A caminho
            </Button>
          )}

          {podeCheguei && (
            <Button
              className="w-full"
              size="lg"
              disabled={transitando}
              onClick={() => transitar("NO_LOCAL")}
            >
              {transitando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <MapPin className="size-4" aria-hidden />
              )}
              Cheguei
            </Button>
          )}

          <a
            href={linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "outline",
              className: "w-full",
            })}
          >
            <MessageCircle className="size-4" aria-hidden />
            Avisar cliente no WhatsApp
          </a>
        </CardContent>
      </Card>

      <AcoesOs osId={osId} estado={detalhe.estado} onConcluido={carregar} />

      {detalhe.complementares.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orçamentos complementares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detalhe.complementares.map((c) => (
              <Link
                key={c.id}
                href={`/campo/os/${c.id}` as Route}
                className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>{c.categoria}</span>
                <Badge variant="secondary">
                  {rotularEstadoCliente(c.estado)}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {detalhe.estado === "ORCADA" ? (
        <Link
          href={`/campo/os/${osId}/aprovacao` as Route}
          className={buttonVariants({ className: "w-full" })}
        >
          <Check className="size-4" aria-hidden />
          Aprovar com o cliente
        </Link>
      ) : null}

      {detalhe.estado === "NO_LOCAL" || detalhe.estado === "EM_EXECUCAO" ? (
        <Link
          href={`/campo/os/${osId}/execucao` as Route}
          className={buttonVariants({
            variant: "secondary",
            className: "w-full",
          })}
        >
          Ir para execução
        </Link>
      ) : null}
    </div>
  );
}
