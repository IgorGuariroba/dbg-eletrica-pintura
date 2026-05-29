import Image from "next/image";
import type { Servico } from "@/catalogo/servico-repo";
import { formatBRL } from "@/lib/utils";

const ORDEM_CATEGORIA: Servico["categoria"][] = ["ELETRICA", "PINTURA", "DRYWALL"];

const LABEL_CATEGORIA: Record<Servico["categoria"], string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

const LABEL_UNIDADE: Record<Servico["unidade"], string> = {
  PONTO: "por ponto",
  M2: "por m²",
  HORA: "por hora",
};

export function ServicosGrid({ servicos }: { servicos: Servico[] }) {
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
        <h2 className="text-2xl md:text-3xl font-bold">Nossos serviços</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          Preços fixos, sem orçamento na hora. O que você vê é o que paga.
        </p>
      </div>

      <div className="space-y-12">
        {ORDEM_CATEGORIA.filter((c) => porCategoria.has(c)).map((cat) => {
          const items = porCategoria.get(cat)!;
          return (
          <div key={cat}>
            <h3 className="text-lg font-semibold mb-4">
              {LABEL_CATEGORIA[cat]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((s) => (
                <article
                  key={s.id}
                  className="rounded-lg border bg-card overflow-hidden flex flex-col"
                >
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
                  ) : (
                    <div className="aspect-video bg-muted" aria-hidden />
                  )}
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
                </article>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}
