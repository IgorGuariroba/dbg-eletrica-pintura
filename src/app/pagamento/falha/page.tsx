import Link from "next/link";
import { XCircle, HelpCircle, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";

export const metadata = {
  title: "Pagamento não concluído — DBG Elétrica e Pintura",
};

export default function PagamentoFalhaPage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-md px-4 py-20 min-h-[70vh] flex flex-col justify-center">
        <div className="rounded-2xl border bg-background p-8 shadow-lg text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-destructive" />
          
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pagamento não concluído
            </h1>
            <p className="text-sm text-muted-foreground">
              Não conseguimos processar o seu pagamento no momento. Nenhuma cobrança foi realizada.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-left text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-1">
              <HelpCircle className="size-3.5 text-primary" />
              O que pode ter acontecido?
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Saldo insuficiente ou limite do cartão de crédito.</li>
              <li>A transação foi recusada pela instituição financeira.</li>
              <li>Tempo limite para pagamento excedido.</li>
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className={buttonVariants({
                className: "w-full min-h-[44px] text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] gap-1.5 cursor-pointer",
              })}
            >
              Tentar novamente
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
