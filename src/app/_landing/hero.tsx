import Link from "next/link";
import Image from "next/image";
import { MapPin, Zap, Ruler, Paintbrush, BadgeCheck, ShieldCheck, Wallet, Camera } from "lucide-react";
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

// Sinais de confiança SEMPRE verdadeiros (não dependem de métrica real —
// nada de número fabricado). Métricas reais vivem em <Diferenciais>, gated.
const SINAIS = [
  { icone: Wallet, texto: "Preço aprovado antes" },
  { icone: ShieldCheck, texto: "Garantia no papel" },
  { icone: BadgeCheck, texto: "Sem adiantamento" },
  { icone: Camera, texto: "Foto antes e depois" },
] as const;

const SERVICOS = [
  { icone: Zap, nome: "Elétrica", desc: "Disjuntor, chuveiro, tomada, ventilador." },
  { icone: Ruler, nome: "Drywall", desc: "Divisória, forro, home office, sanca." },
  { icone: Paintbrush, nome: "Pintura", desc: "Quarto, casa inteira, retoque." },
] as const;

export function Hero({ bairros }: { bairros: string[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-background to-muted/30 dark:from-background dark:to-background border-b border-border/40">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Coluna Esquerda: Textos e CTA */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card px-3.5 py-1 text-xs font-semibold text-muted-foreground shadow-2xs">
              <Zap className="size-3.5 text-primary" />
              Elétrica, Pintura e Drywall residencial
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-foreground">
              Eletricista e pintor de confiança pra sua casa.
            </h1>

            <p className="mt-6 text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl">
              Você aprova o preço antes do serviço começar e tem garantia no papel. Sem surpresa no final, sem estranho sem rosto na sua casa.
            </p>

            <div className="mt-8 flex flex-col items-start gap-2 w-full sm:w-auto">
              <Link
                href="/solicitar"
                className={buttonVariants({ size: "lg", variant: "gradient", className: "w-full sm:w-auto" })}
              >
                Pedir orçamento grátis
              </Link>
              <span className="text-xs text-muted-foreground">
                2 minutos, sem ligação ·{" "}
                <Link href="#servicos" className="underline underline-offset-2 hover:text-foreground">
                  ver serviços e preços
                </Link>
              </span>
            </div>

            <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {textoCobertura(bairros)}
            </p>
          </div>

          {/* Coluna Direita: uma imagem decisiva + lista compacta de serviços.
              Um único elemento dominante (não trio de cards competindo). */}
          <div className="lg:col-span-5 w-full">
            <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src="/images/landing/pincel-hero.png"
                  alt="Serviço de pintura residencial"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                  priority
                />
              </div>
              <ul className="divide-y divide-border/40">
                {SERVICOS.map((s) => (
                  <li key={s.nome} className="flex items-center gap-3 p-4">
                    <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                      <s.icone className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {s.nome}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

        {/* Faixa de sinais de confiança (verdadeiros, sem número fabricado) */}
        <div className="mt-16 border-t border-border/40 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {SINAIS.map((sinal) => (
            <div key={sinal.texto} className="flex items-center gap-2.5">
              <sinal.icone className="size-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm font-medium text-foreground leading-tight">
                {sinal.texto}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
