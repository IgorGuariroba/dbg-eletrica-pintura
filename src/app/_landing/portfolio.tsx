import Image from "next/image";
import { cn } from "@/lib/utils";

export interface FotoPortfolioView {
  id: string;
  osId: string;
  url: string;
  categoria: "ELETRICA" | "PINTURA" | "DRYWALL";
  tipo: "ANTES" | "DEPOIS";
  tecnicoNome: string | null;
}

interface Par {
  antes: FotoPortfolioView;
  depois: FotoPortfolioView;
  categoria: FotoPortfolioView["categoria"];
  tecnicoNome: string | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

// Ritmo bento: herói grande (2×2) abrindo o grid, um tile largo no meio do
// ciclo e o resto 1×1 — empacotado denso pra fechar os buracos. A variação de
// escala é o que dá impacto; sem ela vira masonry chapado.
function spanBento(i: number): string {
  const m = i % 6;
  if (m === 0) return "col-span-2 row-span-2";
  if (m === 3) return "col-span-2";
  return "";
}

interface Props {
  fotos: FotoPortfolioView[];
  /**
   * Máximo de fotos na landing principal (carga cognitiva baixa).
   * Omitido = todas as fotos públicas carregadas.
   */
  limite?: number;
}

// Fallback honesto: fotos reais da equipe, cada uma de um serviço distinto
// (osId único → nenhuma vira par; não forjamos um "antes/depois do mesmo
// serviço" a partir de trabalhos diferentes).
const FOTOS_PADRAO: FotoPortfolioView[] = [
  {
    id: "default-1",
    osId: "demo-1",
    url: "/images/portfolio/14-forro-gesso-led-residencial.jpeg",
    categoria: "DRYWALL",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-2",
    osId: "demo-2",
    url: "/images/portfolio/16-estrutura-drywall-divisorias.jpeg",
    categoria: "DRYWALL",
    tipo: "ANTES",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-3",
    osId: "demo-3",
    url: "/images/portfolio/17-quarto-forro-iluminacao-indireta.jpeg",
    categoria: "DRYWALL",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-4",
    osId: "demo-4",
    url: "/images/portfolio/04-academia-allp-iluminacao-led.jpeg",
    categoria: "ELETRICA",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-5",
    osId: "demo-5",
    url: "/images/portfolio/05-reparo-parede-obra.jpeg",
    categoria: "PINTURA",
    tipo: "ANTES",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-6",
    osId: "demo-6",
    url: "/images/portfolio/08-academia-area-musculacao-led.jpeg",
    categoria: "ELETRICA",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
];

// Agrupa por OS+categoria: grupo com ANTES e DEPOIS vira par; o resto (e
// fotos sem contraparte) vira tile solto. Ordem de recência preservada.
function separarParesESingles(fotos: FotoPortfolioView[]): {
  pares: Par[];
  singles: FotoPortfolioView[];
} {
  const grupos = new Map<string, FotoPortfolioView[]>();
  for (const f of fotos) {
    const chave = `${f.osId}|${f.categoria}`;
    const arr = grupos.get(chave) ?? [];
    arr.push(f);
    grupos.set(chave, arr);
  }

  const pares: Par[] = [];
  const singles: FotoPortfolioView[] = [];
  for (const grupo of grupos.values()) {
    const antes = grupo.find((f) => f.tipo === "ANTES");
    const depois = grupo.find((f) => f.tipo === "DEPOIS");
    if (antes && depois) {
      pares.push({
        antes,
        depois,
        categoria: antes.categoria,
        tecnicoNome: depois.tecnicoNome ?? antes.tecnicoNome,
      });
      for (const f of grupo) {
        if (f !== antes && f !== depois) singles.push(f);
      }
    } else {
      singles.push(...grupo);
    }
  }
  return { pares, singles };
}

function LadoComparacao({
  foto,
  rotulo,
}: {
  foto: FotoPortfolioView;
  rotulo: "Antes" | "Depois";
}) {
  return (
    <div className="relative">
      <div className="relative aspect-[4/3] bg-muted">
        {/* Aspect fixo → next/image com fill rende otimização (R2 em
            remotePatterns). As fotos avulsas usam img comum por serem masonry
            de altura natural. */}
        <Image
          src={foto.url}
          alt={`${CATEGORIA_LABEL[foto.categoria] ?? foto.categoria} — ${rotulo.toLowerCase()}`}
          fill
          sizes="(max-width: 639px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
        {rotulo}
      </span>
    </div>
  );
}

export function Portfolio({ fotos, limite }: Props) {
  const usandoPadrao = fotos.length === 0;
  const listaFotos = usandoPadrao ? FOTOS_PADRAO : fotos;
  const visiveis = limite != null ? listaFotos.slice(0, limite) : listaFotos;
  const { pares, singles } = separarParesESingles(visiveis);

  return (
    <section id="portfolio" className="bg-muted scroll-mt-24">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Veja o serviço pronto, não a promessa
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            {usandoPadrao
              ? "Fotos reais de serviços executados pela equipe DBG."
              : "Fotos reais de serviços concluídos, publicadas com permissão do cliente."}
          </p>
        </div>

        {/* Pares antes/depois: a prova da transformação, lado a lado no desktop,
            empilhado no mobile. */}
        {pares.length > 0 && (
          <div className="space-y-4 mb-4">
            {pares.map((par) => (
              <figure
                key={`${par.antes.id}-${par.depois.id}`}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <LadoComparacao foto={par.antes} rotulo="Antes" />
                  <LadoComparacao foto={par.depois} rotulo="Depois" />
                </div>
                <figcaption className="flex items-center justify-between gap-2 p-3 text-xs">
                  <span className="font-medium">
                    {CATEGORIA_LABEL[par.categoria] ?? par.categoria}
                  </span>
                  {par.tecnicoNome && (
                    <span className="text-muted-foreground">
                      por {par.tecnicoNome}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {/* Fotos avulsas (sem contraparte): grid bento assimétrico. Células de
            tamanho fixo (object-cover) + spans variados deixam a foto ser o
            protagonista — legenda sobreposta em vez de card abaixo. */}
        {singles.length > 0 && (
          <ul className="grid grid-cols-2 md:grid-cols-4 auto-rows-[8.5rem] md:auto-rows-[10.5rem] grid-flow-dense gap-3">
            {singles.map((f, i) => (
              <li
                key={f.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-shadow hover:shadow-md",
                  spanBento(i),
                )}
              >
                <Image
                  src={f.url}
                  alt={`${CATEGORIA_LABEL[f.categoria] ?? f.categoria} — foto ${
                    f.tipo === "ANTES" ? "antes" : "depois"
                  }`}
                  fill
                  sizes="(max-width: 767px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
                />
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                  {f.tipo === "ANTES" ? "Antes" : "Depois"}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent p-3 pt-8">
                  <span className="text-sm font-semibold text-background">
                    {CATEGORIA_LABEL[f.categoria] ?? f.categoria}
                  </span>
                  {f.tecnicoNome && (
                    <p className="text-xs text-background/80">
                      por {f.tecnicoNome}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
