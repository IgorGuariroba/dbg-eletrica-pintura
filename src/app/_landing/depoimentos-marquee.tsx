"use client";

import type { DepoimentoCandidato } from "@/marketing/landing/depoimentos-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function obterIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface DepoimentosMarqueeProps {
  depoimentos: DepoimentoCandidato[];
}

export function DepoimentosMarquee({ depoimentos }: DepoimentosMarqueeProps) {
  if (depoimentos.length === 0) return null;

  // Split testimonials into two rows
  const row1 = depoimentos.filter((_, i) => i % 2 === 0);
  const row2 = depoimentos.filter((_, i) => i % 2 !== 0);

  // Fallback to row1 if row2 is empty
  const finalRow2 = row2.length > 0 ? row2 : row1;

  // Repeat items to ensure seamless infinite scrolling marquee (needs to fill screen width twice)
  const duplicatedRow1 = [...row1, ...row1, ...row1];
  const duplicatedRow2 = [...finalRow2, ...finalRow2, ...finalRow2];

  const renderCard = (d: DepoimentoCandidato, idx: number) => {
    const handle = `@${d.nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")}`;

    return (
      <div
        key={`${d.avaliacaoId}-${idx}`}
        className="w-[300px] sm:w-[320px] shrink-0 rounded-[18px] border border-border/60 bg-background/90 p-5 md:p-5.5 flex flex-col gap-5 select-none"
      >
        <p className="text-[15px] leading-6 text-foreground/90 line-clamp-4">
          &ldquo;{d.texto}&rdquo;
        </p>

        <div className="mt-auto flex items-center gap-3 pt-1">
          <Avatar className="size-9 shrink-0 border border-border/70">
            <AvatarFallback className="bg-primary/10 text-brand-ink font-semibold text-[11px]">
              {obterIniciais(d.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {d.nome}
            </span>
            <span className="text-xs text-muted-foreground">{handle}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="group relative w-full overflow-hidden border-y border-border/40 bg-gradient-to-b from-background to-muted/20 py-8 md:py-10">
      <div className="flex w-full flex-col gap-4 mask-fade">
        <div className="flex w-full overflow-hidden py-1">
          <div className="flex gap-3 md:gap-4 animate-marquee-left group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:w-full motion-reduce:px-4">
            {duplicatedRow1.map((d, i) => renderCard(d, i))}
          </div>
        </div>

        <div className="flex w-full overflow-hidden py-1">
          <div className="flex gap-3 md:gap-4 animate-marquee-right group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:w-full motion-reduce:px-4">
            {duplicatedRow2.map((d, i) => renderCard(d, i))}
          </div>
        </div>
      </div>
    </section>
  );
}
