"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, MapPin, Clock, ArrowRight, RefreshCw } from "lucide-react";
import { rotularCategoria, rotularEstadoOperacao, varianteEstado } from "@/operacao/rotulo-estado";
import { agruparPorDiaSP } from "@/lib/agrupar-por-dia";
import { carregarAgendaAction } from "./actions";

interface ItemAgenda {
  osId: string;
  categoria: string;
  agendadoPara: Date;
  endereco: string;
  estado: string;
}

const TZ = "America/Sao_Paulo";

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: TZ,
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export function AgendaTecnicoClient({
  itensIniciais,
}: {
  itensIniciais: ItemAgenda[];
}) {
  const [itens, setItens] = useState<ItemAgenda[]>(itensIniciais);
  const [atualizando, startAtualizar] = useTransition();

  const atualizarAgenda = () => {
    startAtualizar(async () => {
      try {
        const novosItens = await carregarAgendaAction();
        // Convert string dates to Date objects if needed, but Next.js Server Actions already return serialized Date objects as Dates.
        setItens(novosItens);
      } catch (err) {
        console.error("Falha ao atualizar agenda:", err);
      }
    });
  };

  useEffect(() => {
    const interval = setInterval(atualizarAgenda, 60000);
    return () => clearInterval(interval);
  }, []);

  const grupos = agruparPorDiaSP(itens, (item) => item.agendadoPara);

  return (
    <div className="space-y-6">
      {/* Indicador de Atualização */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Atualização automática (60s)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={atualizarAgenda}
          disabled={atualizando}
          className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`size-3.5 ${atualizando ? "animate-spin" : ""}`} />
          {atualizando ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      {grupos.length === 0 ? (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="size-10 text-muted-foreground/60 mb-3" />
            <h3 className="font-semibold text-base">Nenhum serviço agendado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Você não possui visitas técnicas agendadas para os próximos 7 dias.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.data.toISOString()} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground capitalize">
                {fmtDia.format(grupo.data)}
              </h2>
              <div className="space-y-3">
                {grupo.itens.map((os) => (
                  <Link
                    key={os.osId}
                    href={`/campo/os/${os.osId}` as Route}
                    className="block hover:no-underline group"
                  >
                    <Card className="overflow-hidden hover:border-primary/40 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold flex items-center gap-1 text-foreground">
                              <Clock className="size-3.5 text-primary" />
                              {fmtHora.format(new Date(os.agendadoPara))}
                            </span>
                            <Badge variant="outline" className="text-xs font-semibold">
                              {rotularCategoria(os.categoria)}
                            </Badge>
                            <Badge variant={varianteEstado(os.estado)} className="text-xs font-medium">
                              {rotularEstadoOperacao(os.estado)}
                            </Badge>
                          </div>

                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0 mt-0.5" />
                            <span className="truncate">{os.endereco}</span>
                          </div>
                        </div>
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted/40 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                          <ArrowRight className="size-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
