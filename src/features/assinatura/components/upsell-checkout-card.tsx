"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CreditCard, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/utils";
import type { OfertaUpsell } from "@/financeiro/upsell/montar-upsell";
import { pagarTudoComAssinaturaAction } from "@/app/s/[token]/pagar/actions";

interface Props {
  token: string;
  oferta: OfertaUpsell;
  /** Há OS pagáveis — habilita o combo "pagar tudo junto + assinar". */
  podePagarTudo: boolean;
}

/**
 * Card de upsell do checkout consolidado (#65): economia visível com o plano
 * destaque + social proof. Aparece uma vez só por cliente (flag no servidor).
 * Ações em variantes secundárias — o CTA principal da tela segue sendo o
 * pagamento.
 */
export function UpsellCheckoutCard({ token, oferta, podePagarTudo }: Props) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  function handlePagarTudoComAssinatura() {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await pagarTudoComAssinaturaAction(token, oferta.planoSlug);
        if (res.erro) {
          toast.error(res.erro);
          setLoading(false);
        } else if (res.url) {
          window.location.href = res.url;
        }
      } catch {
        toast.error("Ocorreu um erro ao processar o seu pagamento.");
        setLoading(false);
      }
    });
  }

  return (
    <Card className="border-accent bg-accent/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="size-4 text-primary" />
            Vire assinante e economize
          </CardTitle>
          <Badge variant="secondary" className="gap-1 shrink-0">
            <Users className="size-3" />
            {oferta.totalAssinantes} já assinaram
          </Badge>
        </div>
        <CardDescription>
          Com o plano <strong>{oferta.planoNome}</strong> (
          {formatBRL(oferta.precoMensal)}/mês), este serviço sairia{" "}
          <strong className="text-foreground">
            {formatBRL(oferta.valorComDesconto)}
          </strong>{" "}
          em vez de um valor cheio — economia de{" "}
          <strong className="text-foreground">
            {formatBRL(oferta.economia)}
          </strong>{" "}
          ({oferta.percentualDesconto}% de desconto pra assinante).
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-xs text-muted-foreground">
          Assinantes também ganham visitas preventivas e prioridade no
          agendamento.
        </p>
      </CardContent>
      <Separator />
      <CardFooter className="flex flex-col gap-2 pt-4 sm:flex-row">
        {podePagarTudo && (
          <Button
            variant="secondary"
            className="w-full sm:flex-1 min-h-[44px]"
            disabled={pending}
            onClick={handlePagarTudoComAssinatura}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Processando…
              </>
            ) : (
              <>
                <CreditCard className="size-4" /> Pagar tudo + assinar junto
              </>
            )}
          </Button>
        )}
        <Link
          href={`/assinar/${oferta.planoSlug}`}
          className={buttonVariants({
            variant: "outline",
            className: "w-full sm:flex-1 min-h-[44px]",
          })}
        >
          Conhecer o plano
        </Link>
      </CardFooter>
    </Card>
  );
}
