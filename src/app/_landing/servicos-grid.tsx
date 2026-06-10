import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import type { Servico } from "@/catalogo/servico-repo";
import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";

const ORDEM_CATEGORIA: Servico["categoria"][] = ["ELETRICA", "PINTURA", "DRYWALL"];

const LABEL_CATEGORIA: Record<Servico["categoria"], string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

const ANCORA_CATEGORIA: Record<Servico["categoria"], string> = {
  ELETRICA: "eletrica",
  PINTURA: "pintura",
  DRYWALL: "drywall",
};

const LABEL_UNIDADE: Record<Servico["unidade"], string> = {
  PONTO: "por ponto",
  M2: "por m²",
  HORA: "por hora",
};

interface Props {
  servicos: Servico[];
  /**
   * Máximo de cards por categoria (landing principal — carga cognitiva
   * baixa). Omitido = catálogo completo (página /servicos).
   */
  limitePorCategoria?: number;
  titulo?: string;
  descricao?: string;
}

export function ServicosGrid({
  servicos,
  limitePorCategoria,
  titulo = "Nossos serviços",
  descricao = "Preços fixos, sem orçamento na hora. O que você vê é o que paga.",
}: Props) {
  const porCategoria = new Map<Servico["categoria"], Servico[]>();
  for (const s of servicos) {
    const arr = porCategoria.get(s.categoria) ?? [];
    arr.push(s);
    porCategoria.set(s.categoria, arr);
  }

  if (servicos.length === 0) {
    return null;
  }

  return (
    <section id="servicos" className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">{titulo}</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          {descricao}
        </p>
      </div>

      <div className="space-y-12">
        {ORDEM_CATEGORIA.filter((c) => porCategoria.has(c)).map((cat) => {
          const todos = porCategoria.get(cat)!;
          const items =
            limitePorCategoria != null
              ? todos.slice(0, limitePorCategoria)
              : todos;
          const ocultos = todos.length - items.length;
          return (
          <div key={cat} id={ANCORA_CATEGORIA[cat]} className="scroll-mt-20">
            <h3 className="text-lg font-semibold mb-4">
              {LABEL_CATEGORIA[cat]}
            </h3>
            {/* Masonry: colunas CSS (sem JS); break-inside-avoid impede card
                partido entre colunas. */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {items.map((s) => {
                const conteudo = (
                  <>
                    {s.fotoUrl ? (
                      <div className="relative aspect-video bg-muted">
                        <Image
                          src={s.fotoUrl}
                          alt={s.nome}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-medium">{s.nome}</h4>
                      <div className="mt-auto pt-3 flex items-baseline justify-between">
                        <span className="text-xl font-bold tabular-nums">
                          {formatBRL(s.precoBase)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {LABEL_UNIDADE[s.unidade]}
                        </span>
                      </div>
                      {s.prazoGarantiaMeses > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Garantia de {s.prazoGarantiaMeses}{" "}
                          {s.prazoGarantiaMeses === 1 ? "mês" : "meses"}
                        </p>
                      )}
                    </div>
                  </>
                );
                const classeCard =
                  "mb-4 break-inside-avoid rounded-lg border bg-card overflow-hidden flex flex-col";
                // Serviço com slug tem landing própria — card vira link.
                return s.slug ? (
                  <Link
                    key={s.id}
                    href={`/servicos/${s.slug}` as Route}
                    className={`${classeCard} transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <article key={s.id} className={classeCard}>
                    {conteudo}
                  </article>
                );
              })}
            </div>
            {ocultos > 0 && (
              <div className="mt-4">
                <Link
                  href={`/servicos#${ANCORA_CATEGORIA[cat]}` as Route}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  {`Ver todos os ${todos.length} serviços de ${LABEL_CATEGORIA[cat]}`}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
