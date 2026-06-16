"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Membro } from "@/equipe/membro-repo";

export interface MembroComNota extends Membro {
  avaliacaoMedia?: number | null;
  totalAvaliacoes?: number;
}

interface Props {
  tecnicos: MembroComNota[];
  compacta?: boolean;
}

function EquipeCompacta({ tecnicos }: { tecnicos: MembroComNota[] }) {
  const [activeId, setActiveId] = useState<string>(() => tecnicos[0]?.id || "");
  const activeTecnico = tecnicos.find((t) => t.id === activeId) || tecnicos[0];

  if (!activeTecnico) return null;

  return (
    <section id="equipe" className="py-20 md:py-28 bg-background scroll-mt-24 border-t border-border/40">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Title, description, selection list */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.08] text-wrap-balance">
                Conheça quem vai entrar na sua casa
              </h2>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xl">
                Cada técnico tem nome, foto e avaliação real dos clientes. Você vê a ficha completa com especialidades e notas antes de abrir a porta. Nada de estranhos sem rosto.
              </p>
            </div>

            {/* Technician selection buttons */}
            <div className="space-y-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Selecione um profissional para ver a ficha:
              </span>
              <div className="flex flex-wrap gap-3">
                {tecnicos.map((t) => {
                  const isActive = t.id === activeId;
                  const inicial = t.nome.charAt(0).toUpperCase();
                  const temAvaliacoes = (t.totalAvaliacoes ?? 0) > 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveId(t.id)}
                      onMouseEnter={() => setActiveId(t.id)}
                      className={`group relative flex items-center gap-3 p-2.5 pr-4 rounded-xl border text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                          : "bg-card border-border/60 hover:border-border-foreground/20 hover:bg-muted/30"
                      }`}
                      type="button"
                      aria-label={`Ver ficha de ${t.nome}`}
                    >
                      <Avatar className="size-10 ring-2 ring-background shrink-0">
                        {t.fotoUrl && (
                          <AvatarImage
                            src={t.fotoUrl}
                            alt={t.nome}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="font-semibold bg-muted text-foreground">
                          {inicial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className={`font-semibold transition-colors ${isActive ? "text-primary animate-pulse" : "text-foreground"}`}>
                          {t.nome.split(" ")[0]}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {temAvaliacoes ? (
                            <>
                              <Star className="size-3 fill-rating text-rating" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {(t.avaliacaoMedia ?? 0).toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              Novo
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={"/equipe" as Route}
                className={buttonVariants({ variant: "outline", className: "group gap-2 hover:bg-muted/40 font-medium" })}
              >
                Conhecer a equipe completa ({tecnicos.length})
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Selected Technician Detail Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto lg:mx-0 lg:sticky lg:top-28">
            <div className="relative bg-card ring-1 ring-foreground/10 rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-300">
              {/* Card Header with Photo and Rating */}
              <div className="flex items-start gap-4">
                <Avatar className="size-20 md:size-24 border border-border/80 shadow-inner shrink-0">
                  {activeTecnico.fotoUrl && (
                    <AvatarImage
                      src={activeTecnico.fotoUrl}
                      alt={activeTecnico.nome}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-2xl font-bold bg-primary/5 text-primary">
                    {activeTecnico.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5">
                  <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                    {activeTecnico.nome}
                  </h3>
                  
                  {/* Rating Display */}
                  {(activeTecnico.totalAvaliacoes ?? 0) > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => {
                          const isFilled = i < Math.round(activeTecnico.avaliacaoMedia ?? 0);
                          return (
                            <Star
                              key={i}
                              className={`size-4 ${
                                isFilled ? "fill-rating text-rating" : "text-border fill-muted"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {(activeTecnico.avaliacaoMedia ?? 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({activeTecnico.totalAvaliacoes}{" "}
                        {activeTecnico.totalAvaliacoes === 1 ? "avaliação" : "avaliações"})
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem avaliações ainda</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeTecnico.especialidades.map((esp) => (
                      <Badge
                        key={esp}
                        variant="secondary"
                        className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 bg-primary/5 text-primary border border-primary/10 rounded-md"
                      >
                        {esp}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bio / Description */}
              {activeTecnico.bio && (
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Sobre o profissional:
                  </span>
                  <p className="text-sm text-foreground/90 leading-relaxed italic bg-muted/20 p-4 rounded-xl border border-border/30">
                    &ldquo;{activeTecnico.bio}&rdquo;
                  </p>
                </div>
              )}

              {/* Verification Badges */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="size-5 text-success shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Antecedentes</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Ficha 100% limpa e verificada.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <UserCheck className="size-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Homologado DBG</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Testado técnica e comercialmente.</p>
                  </div>
                </div>
              </div>

              {/* Full profile link */}
              {activeTecnico.slug && (
                <div className="pt-2 border-t border-border/40">
                  <Link
                    href={`/tecnico/${activeTecnico.slug}` as Route}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full text-xs font-semibold hover:bg-muted/40",
                    })}
                  >
                    Ver histórico de serviços e portfólio
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Equipe({ tecnicos, compacta }: Props) {
  if (tecnicos.length === 0) return null;

  if (compacta) return <EquipeCompacta tecnicos={tecnicos} />;

  return (
    <section id="equipe" className="py-20 md:py-28 bg-background scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-16">
        <div className="max-w-2xl text-left space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.08] text-wrap-balance">
            Conheça quem vai entrar na sua casa
          </h2>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            Cada profissional homologado pela DBG é rigorosamente avaliado, tem ficha técnica verificada e avaliações de clientes reais. Transparência total antes da visita começar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tecnicos.map((tecnico) => {
            const inicial = tecnico.nome.charAt(0).toUpperCase();
            return (
              <div
                key={tecnico.id}
                className="group flex flex-col justify-between p-6 bg-card ring-1 ring-foreground/10 rounded-2xl hover:ring-foreground/20 transition-all duration-300"
              >
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="size-16 border border-border/80 shrink-0">
                      {tecnico.fotoUrl && (
                        <AvatarImage
                          src={tecnico.fotoUrl}
                          alt={tecnico.nome}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="text-xl font-bold bg-primary/5 text-primary">
                        {inicial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                        {tecnico.nome}
                      </h3>
                      
                      {/* Rating row */}
                      {(tecnico.totalAvaliacoes ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Star className="size-3.5 fill-rating text-rating" />
                          <span className="text-sm font-semibold text-foreground">
                            {(tecnico.avaliacaoMedia ?? 0).toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({tecnico.totalAvaliacoes}{" "}
                            {tecnico.totalAvaliacoes === 1 ? "avaliação" : "avaliações"})
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem avaliações ainda</p>
                      )}
                    </div>
                  </div>

                  {tecnico.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 italic">
                      &ldquo;{tecnico.bio}&rdquo;
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {tecnico.especialidades.map((esp) => (
                      <Badge
                        key={esp}
                        variant="secondary"
                        className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 bg-primary/5 text-primary border border-primary/10 rounded-md"
                      >
                        {esp}
                      </Badge>
                    ))}
                  </div>
                </div>

                {tecnico.slug && (
                  <div className="pt-6 mt-6 border-t border-border/40">
                    <Link
                      href={`/tecnico/${tecnico.slug}` as Route}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "w-full text-xs font-semibold hover:bg-muted/40",
                      })}
                    >
                      Ver perfil completo
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

