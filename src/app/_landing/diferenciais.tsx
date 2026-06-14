import {
  ArrowRight,
  BadgeDollarSign,
  Route,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MetricasPublicas } from "@/marketing/landing/metricas-publicas-query";

// Abaixo deste mínimo o número joga contra (parece empresa recém-aberta):
// esconde a métrica em vez de exibir valor baixo.
const MIN_OS_CONCLUIDAS = 10;

// Cada medo real da cliente colado ao antídoto da DBG (PRODUCT.md: nomear o
// medo antes da solução). À esquerda, o mundo do "marido de aluguel que some"
// — riscado. À direita, dominante, o jeito DBG.
const PARES: ReadonlyArray<{
  medo: string;
  icone: LucideIcon;
  titulo: string;
  antidoto: string;
}> = [
  {
    medo: "Aceita um preço de boca — e a conta vem maior no final.",
    icone: BadgeDollarSign,
    titulo: "Você aprova o preço antes",
    antidoto: "O que você combinou é o que paga. Sem cobrança a mais.",
  },
  {
    medo: "Espera o dia inteiro e ninguém aparece.",
    icone: Route,
    titulo: "Você acompanha o técnico",
    antidoto: "Vê quando ele sai e quando chega na sua casa.",
  },
  {
    medo: "Fica com um aperto no peito sem saber quem entrou na sua casa.",
    icone: UserCheck,
    titulo: "Você vê quem vai te atender",
    antidoto: "Nome, foto e avaliação do técnico, antes dele chegar.",
  },
  {
    medo: "Já pegou serviço malfeito e ficou no prejuízo.",
    icone: ShieldCheck,
    titulo: "Garantia no papel, com prova",
    antidoto:
      "Foto antes e depois no WhatsApp. Deu problema no prazo, a gente refaz sem cobrar.",
  },
];

export function Diferenciais({ metricas }: { metricas: MetricasPublicas }) {
  const mostrarConcluidas = metricas.osConcluidas >= MIN_OS_CONCLUIDAS;

  return (
    <section
      id="diferenciais"
      aria-label="Por que escolher a DBG"
      className="border-y bg-card scroll-mt-24"
    >
      <div className="container mx-auto px-4 py-20 md:py-28 max-w-5xl">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
            Cansada de chamar e se arrepender? A DBG funciona ao contrário.
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Todo medo de chamar um desconhecido tem um motivo. Pra cada um deles,
            a gente faz o oposto.
          </p>
        </div>

        {/* Pares medo → antídoto. Esquerda riscada e estreita (a dor que some);
            direita larga e dominante (o jeito DBG). A assimetria É a mensagem. */}
        <ul className="mt-14 md:mt-16 divide-y divide-border">
          {PARES.map((par) => (
            <li
              key={par.titulo}
              className="group grid items-center gap-5 py-8 md:py-10 sm:grid-cols-[minmax(0,4fr)_auto_minmax(0,7fr)] sm:gap-8"
            >
              <p className="flex items-start gap-2 text-sm text-muted-foreground line-through decoration-muted-foreground/40">
                <X
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 no-underline"
                  aria-hidden
                />
                <span>{par.medo}</span>
              </p>

              <ArrowRight
                className="hidden size-6 shrink-0 text-primary sm:block"
                aria-hidden
              />

              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-xl bg-primary/10 p-3 text-primary transition-colors duration-200 ease-out motion-safe:group-hover:bg-primary motion-safe:group-hover:text-primary-foreground">
                  <par.icone className="size-6" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-semibold tracking-tight">
                    {par.titulo}
                  </h3>
                  <p className="mt-1.5 text-sm md:text-base text-muted-foreground leading-relaxed">
                    {par.antidoto}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {mostrarConcluidas && (
          <p className="mt-14 flex items-baseline gap-3">
            <strong className="font-mono text-3xl md:text-4xl font-bold text-primary">
              {metricas.osConcluidas}
            </strong>
            <span className="text-muted-foreground">
              serviços concluídos com esse jeito de trabalhar
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
