export interface FotoPortfolioView {
  id: string;
  url: string;
  categoria: "ELETRICA" | "PINTURA" | "DRYWALL";
  tipo: "ANTES" | "DEPOIS";
  tecnicoNome: string | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

interface Props {
  fotos: FotoPortfolioView[];
  /**
   * Máximo de fotos na landing principal (carga cognitiva baixa).
   * Omitido = todas as fotos públicas carregadas.
   */
  limite?: number;
}

const FOTOS_PADRAO: FotoPortfolioView[] = [
  {
    id: "default-1",
    url: "/images/portfolio/14-forro-gesso-led-residencial.jpeg",
    categoria: "DRYWALL",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-2",
    url: "/images/portfolio/16-estrutura-drywall-divisorias.jpeg",
    categoria: "DRYWALL",
    tipo: "ANTES",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-3",
    url: "/images/portfolio/17-quarto-forro-iluminacao-indireta.jpeg",
    categoria: "DRYWALL",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-4",
    url: "/images/portfolio/04-academia-allp-iluminacao-led.jpeg",
    categoria: "ELETRICA",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-5",
    url: "/images/portfolio/05-reparo-parede-obra.jpeg",
    categoria: "PINTURA",
    tipo: "ANTES",
    tecnicoNome: "Equipe DBG",
  },
  {
    id: "default-6",
    url: "/images/portfolio/08-academia-area-musculacao-led.jpeg",
    categoria: "ELETRICA",
    tipo: "DEPOIS",
    tecnicoNome: "Equipe DBG",
  },
];

export function Portfolio({ fotos, limite }: Props) {
  const usandoPadrao = fotos.length === 0;
  const listaFotos = usandoPadrao ? FOTOS_PADRAO : fotos;
  const visiveis = limite != null ? listaFotos.slice(0, limite) : listaFotos;

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

        {/* Masonry: colunas CSS; fotos em altura natural para o fluxo variar. */}
        <ul className="columns-1 md:columns-2 gap-4">
          {visiveis.map((f) => (
            <li
              key={f.id}
              className="mb-4 break-inside-avoid rounded-lg border bg-card overflow-hidden"
            >
              <div className="relative bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={`${CATEGORIA_LABEL[f.categoria] ?? f.categoria} — foto ${
                    f.tipo === "ANTES" ? "antes" : "depois"
                  }`}
                  loading="lazy"
                  className="w-full h-auto"
                />
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                  {f.tipo === "ANTES" ? "Antes" : "Depois"}
                </span>
              </div>
              <div className="p-3">
                <span className="text-xs font-medium">
                  {CATEGORIA_LABEL[f.categoria] ?? f.categoria}
                </span>
                {f.tecnicoNome && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    por {f.tecnicoNome}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
