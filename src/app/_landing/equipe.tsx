import Link from "next/link";
import type { Route } from "next";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Membro } from "@/equipe/membro-repo";
import { buttonVariants } from "@/components/ui/button";

interface Props {
  tecnicos: Membro[];
}

export function Equipe({ tecnicos }: Props) {
  if (tecnicos.length === 0) return null;

  return (
    <section id="equipe" className="py-16 md:py-24 bg-background">
      <div className="mx-auto max-w-5xl px-4 md:px-6 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl text-foreground">
            Conheça Nossa Equipe
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            Profissionais qualificados, de confiança e homologados pela DBG para garantir o melhor atendimento na sua residência.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {tecnicos.map((tecnico) => {
            const inicial = tecnico.nome.charAt(0).toUpperCase();
            return (
              <div
                key={tecnico.id}
                className="flex flex-col items-center p-6 border border-border/80 rounded-xl bg-card text-center space-y-4 hover:shadow-md transition-all duration-300"
              >
                <Avatar className="size-20 border border-border/60 shadow-sm">
                  {tecnico.fotoUrl && (
                    <AvatarImage src={tecnico.fotoUrl} alt={tecnico.nome} className="object-cover" />
                  )}
                  <AvatarFallback className="text-xl font-bold bg-primary/5 text-primary">
                    {inicial}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">{tecnico.nome}</h3>
                  <div className="flex flex-wrap justify-center gap-1">
                    {tecnico.especialidades.map((esp) => (
                      <Badge key={esp} variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 border-primary/20 text-primary">
                        {esp}
                      </Badge>
                    ))}
                  </div>
                </div>
                {tecnico.slug && (
                  <Link
                    href={`/tecnico/${tecnico.slug}` as Route}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs font-medium" })}
                  >
                    Ver perfil completo
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
