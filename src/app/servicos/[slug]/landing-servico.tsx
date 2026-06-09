import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Categoria } from "@/catalogo/servico-repo";
import type { LandingView } from "@/marketing/landing/montar-landing";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SolicitarForm } from "@/app/solicitar/form";
import { formatBRL } from "@/lib/utils";

const LABEL_CATEGORIA: Record<Categoria, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export function LandingServico({
  view,
  bairrosAtendidos,
}: {
  view: LandingView;
  bairrosAtendidos: string[];
}) {
  const [fotoPrincipal, ...fotosSecundarias] = view.fotos;

  return (
    <main className="container mx-auto px-4 py-10 max-w-5xl space-y-16">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <Badge variant="secondary">{LABEL_CATEGORIA[view.categoria]}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {view.titulo}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-prose">
            {view.descricao}
          </p>
          <div className="flex items-baseline gap-3">
            {view.preco.riscado && view.preco.promo ? (
              <>
                <span className="text-3xl font-bold text-foreground">
                  {formatBRL(view.preco.promo)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatBRL(view.preco.base)}
                </span>
              </>
            ) : (
              <span className="text-3xl font-bold text-foreground">
                {formatBRL(view.preco.base)}
              </span>
            )}
          </div>
          <Link
            href={"#solicitar" as Route}
            className={buttonVariants({ size: "lg" })}
          >
            Solicitar orçamento
          </Link>
        </div>
        {fotoPrincipal ? (
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border">
            <Image
              src={fotoPrincipal}
              alt={view.titulo}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        ) : null}
      </section>

      {/* Galeria de fotos adicionais */}
      {fotosSecundarias.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Trabalhos</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {fotosSecundarias.map((url) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-lg border border-border"
              >
                <Image
                  src={url}
                  alt={view.titulo}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Depoimentos */}
      {view.depoimentos.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">O que dizem</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {view.depoimentos.map((d) => (
              <blockquote
                key={`${d.nome}-${d.texto}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: d.nota }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {d.texto}
                </p>
                <footer className="text-xs text-muted-foreground">
                  {d.nome}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      {/* Formulário */}
      <section id="solicitar" className="max-w-xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Solicitar orçamento
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Já deixamos a categoria selecionada. Conte os detalhes e a gente
            retorna no WhatsApp.
          </p>
        </div>
        <SolicitarForm
          bairrosAtendidos={bairrosAtendidos}
          categoriasIniciais={[view.categoria]}
        />
      </section>

      {/* Upsell */}
      {view.upsell ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Também pode interessar</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <span className="text-base font-medium">
                {view.upsell.titulo}
              </span>
              <Link
                href={`/servicos/${view.upsell.slug}` as Route}
                className={buttonVariants({ variant: "outline" })}
              >
                Ver serviço
              </Link>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
