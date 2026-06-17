"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone, BadgeDollarSign, Wrench, FileCheck } from "lucide-react";

const PASSOS = [
  {
    icone: Smartphone,
    titulo: "Você conta o problema",
    texto: "Pelo celular, em 2 minutos. Sem ligação, sem compromisso.",
  },
  {
    icone: BadgeDollarSign,
    titulo: "Você aprova o orçamento",
    texto: "Recebe o preço antes e decide. Não gostou, não paga nada.",
  },
  {
    icone: Wrench,
    titulo: "O técnico resolve",
    texto: "Você vê quando ele sai e quando chega na sua casa.",
  },
  {
    icone: FileCheck,
    titulo: "Você recebe a prova",
    texto: "Foto antes e depois no WhatsApp e garantia no papel.",
  },
] as const;

// Progresso 0→1 conforme a seção atravessa a viewport. A linha preenche e os
// nós acendem em sequência, traduzindo "passo a passo" em movimento.
function useProgressoScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let frame = 0;
    if (reduzido) {
      frame = requestAnimationFrame(() => setProgresso(1));
      return () => cancelAnimationFrame(frame);
    }

    const calcular = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const inicio = vh * 0.85; // começa a preencher quando o topo cruza aqui
      const span = vh * 0.55; // distância de scroll pra completar
      const p = (inicio - rect.top) / span;
      setProgresso(Math.min(1, Math.max(0, p)));
    };
    const agendar = () => {
      if (frame) return;
      frame = requestAnimationFrame(calcular);
    };

    calcular();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
    };
  }, []);

  return { ref, progresso };
}

export function ComoFunciona() {
  const { ref, progresso } = useProgressoScroll();
  const total = PASSOS.length;
  // Nó i acende quando o preenchimento alcança seu ponto na linha.
  const ativo = (i: number) => progresso >= i / total;

  return (
    <section
      id="como-funciona"
      className="container mx-auto px-4 py-20 max-w-5xl scroll-mt-24"
    >
      <div className="mb-12 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Como funciona
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Passo a passo simples e transparente, sem enrolação e sem surpresas.
        </p>
      </div>

      <div ref={ref}>
        {/* Mobile (< md): timeline vertical, linha preenche de cima pra baixo */}
        <ol className="md:hidden relative flex flex-col gap-8 pl-2">
          <span
            className="absolute left-2 top-1 bottom-1 w-px bg-border"
            aria-hidden
          />
          <span
            className="absolute left-2 top-1 w-px bg-primary origin-top transition-transform duration-300 ease-out"
            style={{ height: "calc(100% - 0.5rem)", transform: `scaleY(${progresso})` }}
            aria-hidden
          />
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="relative pl-8">
              <span
                className={`absolute -left-1 top-0.5 flex size-7 items-center justify-center rounded-full text-xs font-bold font-mono ring-1 transition-colors duration-300 ${
                  ativo(i)
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-brand-ink/50 ring-border"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <passo.icone className="size-5 text-brand-ink" aria-hidden />
                  <h3 className="text-base font-semibold text-foreground">
                    {passo.titulo}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {passo.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* Desktop/Tablet (>= md): timeline horizontal, linha preenche da esq→dir */}
        <div className="hidden md:block relative">
          {/* Trilho + preenchimento, alinhados ao centro vertical dos nós (size-12 → top-6) */}
          <span
            className="absolute top-6 left-[12.5%] right-[12.5%] h-px bg-border"
            aria-hidden
          />
          <span
            className="absolute top-6 left-[12.5%] h-px bg-primary origin-left transition-transform duration-300 ease-out"
            style={{ width: "75%", transform: `scaleX(${progresso})` }}
            aria-hidden
          />
          <ol className="grid grid-cols-4 gap-6">
            {PASSOS.map((passo, i) => (
              <li
                key={passo.titulo}
                className="flex flex-col items-center text-center"
              >
                <span
                  className={`relative z-10 flex size-12 items-center justify-center rounded-full text-base font-bold font-mono ring-1 transition-colors duration-300 ${
                    ativo(i)
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-background text-brand-ink/40 ring-border"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <passo.icone
                  className={`mt-5 size-6 transition-colors duration-300 ${
                    ativo(i) ? "text-primary" : "text-brand-ink/70"
                  }`}
                  aria-hidden
                />
                <h3 className="mt-3 text-base font-semibold text-foreground leading-tight">
                  {passo.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {passo.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
