import type { Route } from "next";
import Link from "next/link";
import { AlertCircle, MessageSquare } from "lucide-react";
import { urlWhatsApp } from "@/lib/contato";
import { dataCurta } from "@/portal/ui-helpers";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AcaoRestritaCardProps {
  /** Título do card (ex.: "Cancelamento Restrito"). */
  titulo: string;
  /** Ação no plural usada no corpo (ex.: "cancelamentos"). */
  acaoPlural: string;
  /** Verbo da ação na mensagem de WhatsApp (ex.: "cancelar"). */
  verbo: string;
  osId: string;
  agendadoPara: Date;
}

/**
 * Card exibido quando a OS está dentro da janela restrita (< 24h) e a ação
 * autônoma (cancelar/reagendar) não é permitida. Compartilhado pelas páginas
 * de cancelamento e reagendamento do portal.
 */
export function AcaoRestritaCard({
  titulo,
  acaoPlural,
  verbo,
  osId,
  agendadoPara,
}: AcaoRestritaCardProps) {
  return (
    <Card className="border-destructive bg-destructive/5 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <CardTitle className="text-xl font-bold text-destructive">{titulo}</CardTitle>
        <CardDescription className="text-base text-muted-foreground mt-2">
          Esta visita está agendada para <strong>{dataCurta(agendadoPara)}</strong> (em menos de 24 horas).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-center text-sm md:text-base text-muted-foreground">
        <p>
          Por questões operacionais, {acaoPlural} com menos de 24 horas de antecedência não podem ser realizados de forma autônoma.
        </p>
        <p className="font-semibold text-foreground">
          Entre em contato conosco pelo WhatsApp para que possamos te ajudar com essa alteração.
        </p>
        <div className="pt-4">
          <Link
            href={urlWhatsApp(`Olá! Preciso ${verbo} a visita da OS #${osId.slice(0, 8)} agendada para ${dataCurta(agendadoPara)}.`) as Route}
            className={buttonVariants({ variant: "destructive", size: "lg", className: "w-full font-bold shadow-md cursor-pointer min-h-[44px]" })}
          >
            <MessageSquare className="mr-2 size-5" />
            Falar com Atendimento
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
