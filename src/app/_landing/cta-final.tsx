import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function CtaFinal() {
  return (
    <section className="border-t bg-muted">
      <div className="container mx-auto px-4 py-16 max-w-5xl text-center space-y-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Pronto para resolver?
        </h2>
        <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
          Você aprova o preço antes e só paga no final. Peça pelo celular em 2
          minutos, sem compromisso.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/solicitar"
            className={buttonVariants({ size: "lg", variant: "gradient" })}
          >
            Pedir orçamento grátis
          </Link>
        </div>
      </div>
    </section>
  );
}
