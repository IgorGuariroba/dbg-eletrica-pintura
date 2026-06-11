import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { REGIAO_ATENDIMENTO } from "@/lib/contato";

const MAX_BAIRROS_VISIVEIS = 4;

function textoCobertura(bairros: string[]): string {
  if (bairros.length === 0) return `Atendemos ${REGIAO_ATENDIMENTO}`;
  const visiveis = bairros.slice(0, MAX_BAIRROS_VISIVEIS).join(", ");
  const resto = bairros.length - MAX_BAIRROS_VISIVEIS;
  return resto > 0
    ? `Atendemos ${visiveis} e mais ${resto} ${resto === 1 ? "bairro" : "bairros"}`
    : `Atendemos ${visiveis}`;
}

export function Hero({ bairros }: { bairros: string[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
          <Star className="size-3 fill-current" />
          Elétrica, Pintura e Drywall residencial
        </p>
        <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          Serviço transparente, com preço fixo e garantia.
        </h1>
        <p className="mt-3 text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl">
          Você sabe o preço antes do técnico chegar. Vê o profissional que vai
          atender. Recebe fotos do antes e depois. Sem surpresa no final.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/solicitar"
            className={buttonVariants({ size: "lg", variant: "gradient" })}
          >
            Solicitar orçamento
          </Link>
          <Link
            href="#servicos"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Ver serviços e preços
          </Link>
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {textoCobertura(bairros)}
        </p>
      </div>
    </section>
  );
}
