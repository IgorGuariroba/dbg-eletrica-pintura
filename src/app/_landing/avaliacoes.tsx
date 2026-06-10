import { Star } from "lucide-react";
import type { DepoimentoCandidato } from "@/marketing/landing/depoimentos-query";

export function Avaliacoes({
  depoimentos,
}: {
  depoimentos: DepoimentoCandidato[];
}) {
  if (depoimentos.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">O que dizem</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          Avaliações reais, coletadas após cada ordem de serviço concluída.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {depoimentos.map((d) => (
          <blockquote
            key={d.avaliacaoId}
            className="rounded-lg border bg-card p-5 flex flex-col gap-3"
          >
            <div
              className="flex items-center gap-0.5"
              aria-label={`${d.nota} de 5 estrelas`}
            >
              {Array.from({ length: d.nota }).map((_, i) => (
                <Star key={i} className="size-4 fill-primary text-primary" />
              ))}
            </div>
            <p className="text-sm">&ldquo;{d.texto}&rdquo;</p>
            <footer className="text-xs text-muted-foreground mt-auto">
              — {d.nome}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
