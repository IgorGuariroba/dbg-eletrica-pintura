import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { urlWhatsApp } from "@/lib/contato";

export function CtaFinal() {
  return (
    <section className="border-t bg-muted">
      <div className="container mx-auto px-4 py-16 max-w-5xl text-center space-y-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Pronto para resolver?
        </h2>
        <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
          Preço fixo na hora, sem visita de orçamento. Peça online ou chame no
          WhatsApp.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/solicitar"
            className={buttonVariants({ size: "lg", variant: "gradient" })}
          >
            Solicitar orçamento
          </Link>
          <a
            href={urlWhatsApp("Olá! Quero um orçamento da DBG.")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            <MessageCircle className="size-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
