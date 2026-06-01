import Link from "next/link";
import { CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";

export const metadata = {
  title: "Pagamento Confirmado — DBG Elétrica e Pintura",
};

export default function PagamentoSucessoPage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-md px-4 py-20 min-h-[70vh] flex flex-col justify-center">
        <div className="rounded-2xl border bg-background p-8 shadow-lg text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-success" />

          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pagamento Confirmado!
            </h1>
            <p className="text-sm text-muted-foreground">
              Seu pagamento foi recebido com sucesso. Nosso sistema já está processando e atualizando o status do seu serviço.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs flex items-center justify-center gap-1.5 text-muted-foreground font-medium">
            <ShieldCheck className="size-4 text-success" />
            Transação segura e processamento garantido
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className={buttonVariants({
                className: "w-full min-h-[44px] text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] gap-1.5 cursor-pointer",
              })}
            >
              Voltar para o início
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
