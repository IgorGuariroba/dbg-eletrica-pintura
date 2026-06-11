import Link from "next/link";
import Image from "next/image";
import { MapPin, Star, Zap, Ruler, Paintbrush } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { REGIAO_ATENDIMENTO } from "@/lib/contato";
import type { MetricasPublicas } from "@/marketing/landing/metricas-publicas-query";

const MAX_BAIRROS_VISIVEIS = 4;

function textoCobertura(bairros: string[]): string {
  if (bairros.length === 0) return `Atendemos ${REGIAO_ATENDIMENTO}`;
  const visiveis = bairros.slice(0, MAX_BAIRROS_VISIVEIS).join(", ");
  const resto = bairros.length - MAX_BAIRROS_VISIVEIS;
  return resto > 0
    ? `Atendemos ${visiveis} e mais ${resto} ${resto === 1 ? "bairro" : "bairros"}`
    : `Atendemos ${visiveis}`;
}

export function Hero({ bairros, metricas }: { bairros: string[]; metricas?: MetricasPublicas }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background to-muted/30 dark:from-background dark:to-background border-b border-border/40">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Coluna Esquerda: Textos e CTA */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-2xs">
              <Star className="size-3.5 fill-primary text-primary" />
              Elétrica, Pintura e Drywall residencial
            </div>
            
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-foreground">
              Serviço transparente, com <span className="text-accent-500">preço fixo</span> e <span className="text-accent-500">garantia</span>.
            </h1>
            
            <p className="mt-6 text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl">
              Saber o preço antes, conhecer o técnico e ter garantia total. Sem surpresas. Oferecemos a precisão que sua casa merece com atendimento premium.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-4 w-full sm:w-auto">
              <Link
                href="/solicitar"
                className={buttonVariants({ size: "lg", variant: "gradient", className: "w-full sm:w-auto" })}
              >
                Solicitar orçamento
              </Link>
              <Link
                href="#servicos"
                className={buttonVariants({ size: "lg", variant: "outline", className: "w-full sm:w-auto" })}
              >
                Ver serviços e preços
              </Link>
            </div>
            
            <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <MapPin className="size-4 shrink-0 text-accent-500" aria-hidden />
              {textoCobertura(bairros)}
            </p>
          </div>
          
          {/* Coluna Direita: Grid de Destaques dos Serviços */}
          <div className="lg:col-span-5 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              
              {/* Subcoluna 1 (Elétrica & Drywall) */}
              <div className="flex flex-col gap-4 lg:gap-6 justify-between">
                
                {/* Card Elétrica */}
                <div className="flex-1 rounded-xl border border-border/40 bg-card/60 p-6 shadow-xs backdrop-blur-xs transition-all duration-300 hover:border-accent-500/30 hover:shadow-md flex flex-col items-start gap-4">
                  <div className="rounded-lg bg-accent-500/10 p-2.5 text-accent-500 shadow-2xs">
                    <Zap className="size-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Elétrica</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Instalações seguras e modernas para seu projeto.
                    </p>
                  </div>
                </div>
                
                {/* Card Drywall */}
                <div className="flex-1 rounded-xl border border-border/40 bg-card/60 p-6 shadow-xs backdrop-blur-xs transition-all duration-300 hover:border-accent-500/30 hover:shadow-md flex flex-col items-start gap-4">
                  <div className="rounded-lg bg-accent-500/10 p-2.5 text-accent-500 shadow-2xs">
                    <Ruler className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Drywall</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Estruturas leves e precisas para novos espaços.
                    </p>
                  </div>
                </div>
                
              </div>
              
              {/* Card Pintura (Altura Total) */}
              <div className="rounded-xl border border-border/40 bg-card/60 shadow-xs backdrop-blur-xs transition-all duration-300 hover:border-accent-500/30 hover:shadow-md overflow-hidden flex flex-col min-h-[340px]">
                <div className="relative h-48 sm:h-auto sm:flex-grow bg-muted overflow-hidden">
                  <Image
                    src="/images/landing/pincel-hero.png"
                    alt="Serviço de pintura premium"
                    fill
                    sizes="(max-width: 640px) 100vw, 30vw"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/85 via-transparent to-transparent sm:hidden" />
                </div>
                <div className="p-6 flex flex-col items-start gap-4 shrink-0">
                  <div className="rounded-lg bg-accent-500/10 p-2.5 text-accent-500 shadow-2xs">
                    <Paintbrush className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Pintura</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Acabamento impecável e cores que transformam.
                    </p>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
          
        </div>
        
        {/* Linha de KPIs de Métricas no Rodapé do Hero */}
        <div className="mt-16 border-t border-border/40 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center sm:text-left">
          <div>
            <p className="text-3xl md:text-4xl font-bold font-mono text-accent-500">
              {metricas?.osConcluidas && metricas.osConcluidas > 0 ? `${metricas.osConcluidas}+` : "15k+"}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-semibold">
              Atendimentos
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold font-mono text-accent-500">
              {metricas?.notaMedia != null ? `${metricas.notaMedia.toFixed(1)}/5` : "4.9/5"}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-semibold">
              Avaliação
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold font-mono text-accent-500">
              100%
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-semibold">
              Garantia
            </p>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-bold font-mono text-accent-500">
              24h
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1 font-semibold">
              Orçamento
            </p>
          </div>
        </div>
        
      </div>
    </section>
  );
}
