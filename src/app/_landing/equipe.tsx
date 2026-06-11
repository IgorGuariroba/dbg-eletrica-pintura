import Link from "next/link";
import type { Route } from "next";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import type { Membro } from "@/equipe/membro-repo";
import { buttonVariants } from "@/components/ui/button";

const MAX_AVATARES_COMPACTA = 5;

interface Props {
  tecnicos: Membro[];
  /**
   * Versão compacta para a landing principal (carga cognitiva baixa):
   * pilha de avatares + link para /equipe, sem cards individuais.
   */
  compacta?: boolean;
}

function inicialDe(nome: string): string {
  return nome.charAt(0).toUpperCase();
}

function EquipeCompacta({ tecnicos }: { tecnicos: Membro[] }) {
  const visiveis = tecnicos.slice(0, MAX_AVATARES_COMPACTA);
  const restantes = tecnicos.length - visiveis.length;

  return (
    <section id="equipe" className="py-16 bg-background scroll-mt-24">
      <div className="mx-auto max-w-5xl px-4 md:px-6 text-center space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Conheça Nossa Equipe
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
          Profissionais qualificados e homologados pela DBG. Você vê quem vai
          atender antes da visita.
        </p>
        <AvatarGroup className="justify-center">
          {visiveis.map((t) => {
            const avatar = (
              <Avatar className="size-11 ring-2 ring-background transition-transform duration-200 ease-out hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110">
                {t.fotoUrl && (
                  <AvatarImage
                    src={t.fotoUrl}
                    alt={t.nome}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="font-bold bg-primary/5 text-primary">
                  {inicialDe(t.nome)}
                </AvatarFallback>
              </Avatar>
            );
            return (
              <HoverCard key={t.id}>
                <HoverCardTrigger
                  aria-label={`Perfil de ${t.nome}`}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  render={
                    t.slug ? (
                      <Link href={`/tecnico/${t.slug}` as Route} />
                    ) : undefined
                  }
                >
                  {avatar}
                </HoverCardTrigger>
                <HoverCardContent className="w-56">
                  <div className="flex flex-col items-center gap-2 p-2 text-center">
                    <Avatar size="lg">
                      {t.fotoUrl && (
                        <AvatarImage
                          src={t.fotoUrl}
                          alt={t.nome}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="font-bold bg-primary/5 text-primary">
                        {inicialDe(t.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{t.nome}</p>
                    {t.especialidades.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1">
                        {t.especialidades.map((esp) => (
                          <Badge
                            key={esp}
                            variant="outline"
                            className="text-xs uppercase font-bold tracking-wider py-0 px-1.5 border-primary/20 text-primary"
                          >
                            {esp}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {t.slug && (
                      <p className="text-xs text-muted-foreground">
                        Clique para ver o perfil completo
                      </p>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
          {restantes > 0 && (
            <AvatarGroupCount className="size-11">
              +{restantes}
            </AvatarGroupCount>
          )}
        </AvatarGroup>
        <div>
          <Link
            href={"/equipe" as Route}
            className={buttonVariants({ variant: "outline" })}
          >
            Conhecer a equipe ({tecnicos.length})
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Equipe({ tecnicos, compacta }: Props) {
  if (tecnicos.length === 0) return null;

  if (compacta) return <EquipeCompacta tecnicos={tecnicos} />;

  return (
    <section id="equipe" className="py-16 md:py-24 bg-background scroll-mt-24">
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
                    {inicialDe(tecnico.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">{tecnico.nome}</h3>
                  <div className="flex flex-wrap justify-center gap-1">
                    {tecnico.especialidades.map((esp) => (
                      <Badge key={esp} variant="outline" className="text-xs uppercase font-bold tracking-wider py-0 px-1.5 border-primary/20 text-primary">
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
