"use client";

import * as React from "react";
import type { ChamadoPendenteLista } from "@/operacao/garantia/aplicar-garantia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Wrench, Clock, AlertTriangle, AlertCircle, Phone, FileText } from "lucide-react";

interface GarantiaCardProps {
  chamado: ChamadoPendenteLista;
  onAplicar: (chamado: ChamadoPendenteLista) => void;
  onRejeitar: (chamado: ChamadoPendenteLista) => void;
}

export function GarantiaCard({ chamado, onAplicar, onRejeitar }: GarantiaCardProps) {
  const [agora, setAgora] = React.useState<number>(0);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setAgora(Date.now());
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const formatData = (d: Date) => {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPrazoRestanteText = () => {
    if (!chamado.prazo.fim || new Date(chamado.prazo.fim).getTime() === 0) {
      return { text: "Sem prazo registrado", isCritical: false };
    }

    if (agora === 0) {
      return {
        text: chamado.prazo.dentroDoPrazo ? "Dentro do prazo" : "Fora do prazo",
        isCritical: !chamado.prazo.dentroDoPrazo,
      };
    }

    const fim = new Date(chamado.prazo.fim).getTime();
    const difMs = fim - agora;

    if (difMs < 0) {
      return { text: "Fora do prazo", isCritical: true };
    }

    const dias = Math.ceil(difMs / (1000 * 60 * 60 * 24));
    if (dias === 1) {
      return { text: "1 dia restante", isCritical: true };
    }
    if (dias <= 15) {
      return { text: `${dias} dias restantes`, isCritical: true };
    }
    return { text: `${dias} dias restantes`, isCritical: false };
  };

  const prazo = getPrazoRestanteText();
  const formatWhatsapp = (num: string) => {
    const clean = num.replace(/\D/g, "");
    if (clean.length === 11) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    }
    return num;
  };

  return (
    <Card className="overflow-hidden border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="p-4 border-b border-border bg-muted/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Chamado de Garantia
            </span>
            <CardTitle className="text-lg font-bold text-foreground mt-0.5">
              {chamado.cliente.nome}
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge 
              variant={prazo.isCritical ? "destructive" : "secondary"}
              className="text-xs font-semibold px-2 py-0.5"
            >
              {prazo.isCritical ? (
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Clock className="mr-1 h-3.5 w-3.5" />
              )}
              {prazo.text}
            </Badge>
            {chamado.prazo.fim && new Date(chamado.prazo.fim).getTime() > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Expira: {new Date(chamado.prazo.fim).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col md:flex-row gap-6">
        {/* Left column: Text info */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground font-medium">
                {formatWhatsapp(chamado.cliente.whatsapp)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
              <span>Aberto em: <strong className="text-foreground font-medium">{formatData(chamado.criadoEm)}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span>OS Origem: <strong className="text-foreground font-medium">#{chamado.osOrigem.id.substring(0, 8).toUpperCase()}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wrench className="h-4 w-4 shrink-0 text-primary" />
              <span>Téc. Original: <strong className="text-foreground font-medium">{chamado.tecnicoOriginal?.nome || "Não informado"}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {chamado.temComplementarRejeitado && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-500 font-medium">
                <AlertCircle className="mr-1 h-3.5 w-3.5" />
                Complementar Rejeitado
              </Badge>
            )}
            {chamado.acionamentoInvalido && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive font-medium">
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                Fora do Prazo (Auto)
              </Badge>
            )}
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary-foreground font-medium">
              Canal: {chamado.canal}
            </Badge>
            <Badge variant="outline" className="border-secondary/20 bg-secondary/5 text-secondary-foreground font-medium">
              Cat: {chamado.osOrigem.categoria}
            </Badge>
          </div>

          <div className="rounded-md bg-muted/50 p-3 border border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Relato do Problema
            </h4>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {chamado.descricao}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border">
            <Button
              onClick={() => onAplicar(chamado)}
              className="flex-1 font-semibold"
            >
              {prazo.isCritical && chamado.canal === "WHATSAPP" ? "Aplicar (Override)" : "Aplicar Garantia"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onRejeitar(chamado)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold"
            >
              Rejeitar
            </Button>
          </div>
        </div>

        {/* Right column: Image preview */}
        {chamado.fotoUrl && (
          <div className="w-full md:w-48 h-48 md:h-auto shrink-0 relative rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chamado.fotoUrl}
              alt="Foto do acionamento de garantia"
              className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
