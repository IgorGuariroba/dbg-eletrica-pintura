import Link from "next/link";
import { MapPin, PlugZap, BrickWall, PaintRoller, BadgeCheck, ShieldCheck, FileCheck, HandCoins, Camera, ArrowRight, ClipboardCheck, UserRound, Route, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

const SINAIS = [
  { icone: HandCoins, text: "Sem adiantamento" },
  { icone: Camera, text: "Foto antes e depois" },
  { icone: Route, text: "Acompanhe o técnico" },
  { icone: FileCheck, text: "Garantia no papel" },
] as const;

const SERVICOS = [
  { icone: PlugZap, nome: "Elétrica", desc: "Disjuntor, chuveiro, tomada, ventilador." },
  { icone: BrickWall, nome: "Drywall", desc: "Divisória, forro, home office, sanca." },
  { icone: PaintRoller, nome: "Pintura", desc: "Quarto, casa inteira, retoque." },
] as const;

export function Hero({ bairros }: { bairros: string[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background to-muted/30 dark:from-background dark:to-background border-b border-border/40">
      <div className="container mx-auto max-w-6xl px-4 py-12 md:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">

          {/* Esquerda: problema → 1 CTA */}
          <div className="flex flex-col items-start text-left">
            <p className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-brand-ink">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span>{textoCobertura(bairros)}</span>
            </p>

            <p className="mt-4 text-sm sm:text-base font-semibold text-brand-ink">
              Disjuntor caiu? Chuveiro sem força? Parede pra pintar?
            </p>

            <h1 className="mt-3 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-foreground text-balance">
              Eletricista e pintor de confiança pra sua casa.
            </h1>

            <p className="mt-5 text-muted-foreground text-base md:text-lg leading-relaxed max-w-lg">
              Serviço profissional de elétrica, pintura e drywall com agendamento transparente, técnicos identificados e valor fixado sem surpresas.
            </p>

            <div className="mt-8 flex flex-col items-start gap-2.5 w-full sm:w-auto">
              <Link
                href="/#orcamento"
                className={cn(
                  buttonVariants({ variant: "gradient", className: "w-full sm:w-auto" }),
                  "group/button h-12 px-8 text-base font-bold rounded-xl gap-2 hover:brightness-110 active:translate-y-px transition-all"
                )}
              >
                <span>Pedir orçamento grátis</span>
                <ArrowRight className="size-4.5 shrink-0 transition-transform group-hover/button:translate-x-0.5" />
              </Link>
              <span className="text-xs text-muted-foreground pl-1">2 minutos, sem ligação</span>
            </div>
          </div>

          {/* Direita: demonstração visual de confiança ("Mostrar ao invés de falar") */}
          <div className="flex flex-col gap-4">
            
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/20 p-5 md:p-6 shadow-sm">
              <p className="text-[10px] font-bold tracking-wider text-brand-ink uppercase">Segurança e Transparência</p>
              <h2 className="mt-1 text-lg sm:text-xl font-bold leading-tight text-foreground">
                Tudo sob controle antes da visita começar
              </h2>

              <div className="mt-5 space-y-4">
                {/* 1. Card do Técnico Identificado (Rosto) */}
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background p-4 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 font-bold text-lg">
                      LS
                      <span className="absolute bottom-0 right-0 block size-3 rounded-full bg-success ring-2 ring-background animate-pulse" aria-label="Disponível" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">Lucas Silva</h3>
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success dark:bg-success/20">
                          <BadgeCheck className="size-3" /> Identificado
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Eletricista Parceiro Cadastrado</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs font-bold text-foreground">4.9</span>
                        <div className="flex text-amber-500">
                          <Star className="size-3 fill-current" />
                          <Star className="size-3 fill-current" />
                          <Star className="size-3 fill-current" />
                          <Star className="size-3 fill-current" />
                          <Star className="size-3 fill-current" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">(142 avaliações)</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Identidade</span>
                    <span className="text-xs font-mono font-medium text-foreground bg-muted px-2 py-0.5 rounded">RG 48.***-4</span>
                  </div>
                </div>

                {/* 2. Card do Orçamento Aprovado (Preço & Garantia) */}
                <div className="rounded-xl border border-border/50 bg-background p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-brand-ink" />
                      <span className="text-xs font-bold text-muted-foreground">Orçamento #3492</span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success dark:bg-success/20">
                      Aprovado por você
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Serviço contratado</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">Instalação de Chuveiro + Disjuntor</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Preço Final</p>
                      <p className="text-sm sm:text-base font-bold text-foreground font-mono">R$ 280,00</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/30 px-3 py-2 text-xs text-brand-ink">
                    <ShieldCheck className="size-4 shrink-0 text-brand-ink" />
                    <span><strong>Garantia de 90 dias</strong> registrada e ativa no papel.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {SERVICOS.map((s) => (
                <Link
                  key={s.nome}
                  href="#servicos"
                  className="flex min-h-24 items-center gap-3 rounded-xl border border-border/40 bg-background p-4 outline-none transition-[transform,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-primary focus-visible:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
                >
                  <s.icone className="size-8 shrink-0 text-brand-ink" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{s.nome}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{s.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Faixa de sinais de confiança (verdadeiros, sem número fabricado) */}
        <div className="mt-12 border-t border-border/40 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {SINAIS.map((sinal) => (
            <div key={sinal.text} className="flex items-center gap-2.5">
              <sinal.icone className="size-5 shrink-0 text-brand-ink" aria-hidden />
              <p className="text-sm font-medium text-foreground leading-tight">
                {sinal.text}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
