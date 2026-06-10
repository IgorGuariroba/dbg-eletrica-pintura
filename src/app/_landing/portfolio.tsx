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

export function Portfolio({ fotos, limite }: Props) {
  if (fotos.length === 0) return null;

  const visiveis = limite != null ? fotos.slice(0, limite) : fotos;

  return (
    <section id="portfolio" className="bg-muted">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">
            Trabalhos de verdade
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            Fotos reais de serviços concluídos, publicadas com permissão do
            cliente.
          </p>
        </div>

        {/* Masonry: colunas CSS; fotos em altura natural para o fluxo variar. */}
        <ul className="columns-2 sm:columns-3 gap-4">
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
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
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
