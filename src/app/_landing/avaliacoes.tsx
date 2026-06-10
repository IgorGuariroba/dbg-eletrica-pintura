"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import type { DepoimentoCandidato } from "@/marketing/landing/depoimentos-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function GoogleLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function obterIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avaliacoes({
  depoimentos,
}: {
  depoimentos: DepoimentoCandidato[];
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) return;
    setSelectedIndex(api.selectedScrollSnap());
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  useEffect(() => {
    if (!api) return;
    Promise.resolve().then(() => onSelect(api));
    api.on("reInit", onSelect);
    api.on("select", onSelect);
  }, [api, onSelect]);

  // Autoplay lento (5 segundos), pausando sob hover do usuário.
  useEffect(() => {
    if (!api || hovered) return;

    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [api, hovered]);

  if (depoimentos.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-16 max-w-5xl overflow-hidden">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-bold">O que dizem</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          Avaliações reais de clientes satisfeitos no Google Meu Negócio.
        </p>
      </div>

      <div
        className="relative px-12 sm:px-14 md:px-16"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Carousel
          setApi={setApi}
          className="w-full"
          opts={{
            align: "center",
            loop: true,
          }}
        >
          <CarouselContent className="-ml-4">
            {depoimentos.map((d, index) => {
              const isActive = index === selectedIndex;
              const isExpanded = expanded[d.avaliacaoId];
              const needsTruncation = d.texto.length > 150;

              return (
                <CarouselItem
                  key={d.avaliacaoId}
                  className="pl-4 basis-[85%] sm:basis-[60%] md:basis-[45%] lg:basis-[33.33%] py-4 flex items-center justify-center"
                >
                  <blockquote
                    className={cn(
                      "rounded-xl border bg-card p-6 flex flex-col items-center text-center gap-4 w-full min-h-[300px] transition-all duration-500 ease-in-out select-none",
                      isActive
                        ? "scale-100 opacity-100 shadow-md border-primary/25 z-10"
                        : "scale-[0.85] opacity-50 shadow-none border-border/40 z-0 pointer-events-none"
                    )}
                  >
                    {/* Avatar */}
                    <Avatar className="size-14 text-base border-2 border-primary/10 shrink-0">
                      <AvatarFallback className="bg-primary/10 dark:bg-primary/20 text-primary font-bold">
                        {obterIniciais(d.nome)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Autor & Selo Google */}
                    <div className="flex flex-col items-center min-w-0">
                      <span className="text-sm font-bold text-foreground truncate max-w-full">
                        {d.nome}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap mt-1">
                        <GoogleLogo />
                        <span>Cliente verificado • Google</span>
                      </span>
                    </div>

                    {/* Estrelas */}
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      aria-label={`${d.nota} de 5 estrelas`}
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-4",
                            i < d.nota
                              ? "fill-rating text-rating"
                              : "fill-muted text-muted"
                          )}
                        />
                      ))}
                    </div>

                    {/* Comentário com Clamping opcional */}
                    <div className="flex flex-col items-center flex-grow justify-center">
                      <p
                        className={cn(
                          "text-sm text-foreground/90 leading-relaxed italic max-w-md",
                          !isExpanded && needsTruncation && "line-clamp-3"
                        )}
                      >
                        &ldquo;{d.texto}&rdquo;
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [d.avaliacaoId]: !isExpanded,
                            }))
                          }
                          className="text-xs font-semibold text-primary hover:underline mt-2 pointer-events-auto focus-visible:outline-none"
                        >
                          {isExpanded ? "Ler menos" : "Ler mais"}
                        </button>
                      )}
                    </div>
                  </blockquote>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        {/* Botões de Navegação Externos */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 rounded-full shadow-sm hover:bg-muted shrink-0 size-8 sm:size-10 pointer-events-auto"
          onClick={() => api?.scrollPrev()}
          disabled={!canScrollPrev}
          aria-label="Avaliação anterior"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 md:right-2 top-1/2 -translate-y-1/2 rounded-full shadow-sm hover:bg-muted shrink-0 size-8 sm:size-10 pointer-events-auto"
          onClick={() => api?.scrollNext()}
          disabled={!canScrollNext}
          aria-label="Próxima avaliação"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </section>
  );
}

