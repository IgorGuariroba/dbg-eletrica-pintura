"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Star, MessageSquare, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AvaliacaoGoogle } from "@/marketing/gbp/gbp-gateway";
import type { MetricasReputacao } from "@/marketing/gbp/reputacao-service";
import { responderAvaliacaoAction, type ResponderState } from "./actions";

interface ReputacaoClientProps {
  avaliacoes: AvaliacaoGoogle[];
  metricas: MetricasReputacao;
  usandoDadosFalsos: boolean;
}

function formatarData(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function formatarNota(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i <= nota
              ? "fill-primary text-primary"
              : "fill-muted text-muted-foreground/40",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function MetricaCard({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}

function DialogResponder({ avaliacao }: { avaliacao: AvaliacaoGoogle }) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState<ResponderState, FormData>(
    responderAvaliacaoAction,
    {},
  );
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.success("Resposta enviada ao Google");
      setAberto(false);
    }
    if (state.erro && !jaAvisou.current) {
      jaAvisou.current = true;
      toast.error(state.erro);
    }
  }, [state.ok, state.erro]);

  useEffect(() => {
    if (aberto) jaAvisou.current = false;
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <MessageSquare className="size-4" />
            Responder
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responder avaliação</DialogTitle>
          <DialogDescription>
            Resposta de {avaliacao.autor} — sua resposta fica pública no perfil
            Google do negócio.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reviewId" value={avaliacao.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resposta-${avaliacao.id}`}>Sua resposta</Label>
            <Textarea
              id={`resposta-${avaliacao.id}`}
              name="texto"
              rows={4}
              required
              minLength={2}
              placeholder="Agradeça e seja cordial…"
            />
          </div>
          {state.erro && (
            <p className="text-sm text-destructive" role="alert">
              {state.erro}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar resposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AvaliacaoCard({ avaliacao }: { avaliacao: AvaliacaoGoogle }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{avaliacao.autor}</CardTitle>
            <Estrelas nota={avaliacao.nota} />
          </div>
          <span className="text-xs text-muted-foreground">
            {formatarData(avaliacao.criadoEm)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {avaliacao.comentario ? (
          <p className="text-sm leading-relaxed text-foreground">
            {avaliacao.comentario}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Sem comentário.
          </p>
        )}

        {avaliacao.resposta ? (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Sua resposta
            </p>
            <p className="text-sm text-foreground">{avaliacao.resposta}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">Sem resposta</Badge>
            <DialogResponder avaliacao={avaliacao} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReputacaoClient({
  avaliacoes,
  metricas,
  usandoDadosFalsos,
}: ReputacaoClientProps) {
  const [filtroEstrela, setFiltroEstrela] = useState("todas");

  const filtradas = useMemo(() => {
    if (filtroEstrela === "todas") return avaliacoes;
    return avaliacoes.filter((a) => a.nota === Number(filtroEstrela));
  }, [avaliacoes, filtroEstrela]);

  const diferencaTexto =
    metricas.diferenca === null
      ? "—"
      : `${metricas.diferenca >= 0 ? "+" : ""}${metricas.diferenca.toFixed(1)}`;

  return (
    <div className="space-y-8">
      {usandoDadosFalsos && (
        <div
          className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          role="status"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Dados de demonstração. A integração com o Google Business Profile
            ainda não foi autorizada — verifique o negócio no Google e conclua o
            OAuth para ver avaliações reais.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricaCard
          titulo="Nota média Google"
          valor={formatarNota(metricas.mediaGoogle)}
          detalhe={`${metricas.totalGoogle} avaliaç${metricas.totalGoogle === 1 ? "ão" : "ões"}`}
        />
        <MetricaCard
          titulo="Nota média DBG"
          valor={formatarNota(metricas.mediaDbg)}
          detalhe={`${metricas.totalDbg} avaliaç${metricas.totalDbg === 1 ? "ão" : "ões"} interna${metricas.totalDbg === 1 ? "" : "s"}`}
        />
        <MetricaCard
          titulo="Diferença (Google − DBG)"
          valor={diferencaTexto}
          detalhe="Quanto o Google está acima/abaixo da nota interna"
        />
        <MetricaCard
          titulo="Sem resposta"
          valor={String(metricas.semResposta)}
          detalhe={`${metricas.respondidas} respondida${metricas.respondidas === 1 ? "" : "s"} de ${metricas.totalGoogle}`}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Avaliações Google
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="filtro-estrela" className="text-sm text-muted-foreground">
              Filtrar
            </Label>
            <Select
              value={filtroEstrela}
              onValueChange={(v) => setFiltroEstrela(v ?? "todas")}
            >
              <SelectTrigger id="filtro-estrela" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="5">5 estrelas</SelectItem>
                <SelectItem value="4">4 estrelas</SelectItem>
                <SelectItem value="3">3 estrelas</SelectItem>
                <SelectItem value="2">2 estrelas</SelectItem>
                <SelectItem value="1">1 estrela</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma avaliação para este filtro.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtradas.map((a) => (
              <AvaliacaoCard key={a.id} avaliacao={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
