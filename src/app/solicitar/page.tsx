import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { urlWhatsApp } from "@/lib/contato";
import { SiteHeader } from "../_landing/site-header";
import { SiteFooter } from "../_landing/site-footer";

export const metadata = {
  title: "Solicitar orçamento — DBG Elétrica e Pintura",
};

export default function SolicitarPage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-20 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Solicitar orçamento
        </h1>
        <p className="mt-3 text-muted-foreground">
          O formulário online está em construção. Por enquanto, fale com a gente
          pelo WhatsApp.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={urlWhatsApp("Olá! Quero solicitar um orçamento.")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg" })}
          >
            Falar pelo WhatsApp
          </a>
          <Link
            href="/"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Voltar
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
