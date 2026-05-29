import Link from "next/link";
import { ShieldCheck, Clock, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
          <Star className="size-3 fill-current" />
          Elétrica, Pintura e Drywall residencial
        </p>
        <h1 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          Serviço transparente, com preço fixo e garantia.
        </h1>
        <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-2xl">
          Você sabe o preço antes do técnico chegar. Vê o profissional que vai
          atender. Recebe fotos do antes e depois. Sem surpresa no final.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/solicitar" className={buttonVariants({ size: "lg" })}>
            Solicitar orçamento
          </Link>
          <Link
            href="#servicos"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Ver serviços
          </Link>
        </div>
        <ul className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <li className="flex items-start gap-2">
            <ShieldCheck className="size-4 mt-0.5 text-foreground" />
            <span>
              <strong>Garantia formal</strong> de mão de obra em todo serviço
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="size-4 mt-0.5 text-foreground" />
            <span>
              <strong>Agendamento digital</strong> sem precisar ligar
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="size-4 mt-0.5 text-foreground" />
            <span>
              <strong>Avaliação por OS</strong> — você dá a nota do técnico
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
