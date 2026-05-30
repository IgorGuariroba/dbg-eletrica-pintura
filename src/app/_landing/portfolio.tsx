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

export function Portfolio({ fotos }: { fotos: FotoPortfolioView[] }) {
  return (
    <section className="bg-muted">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Portfólio</h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            Fotos reais de serviços concluídos, publicadas com permissão do
            cliente.
          </p>
        </div>

        {fotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Galeria em breve — estamos selecionando os melhores trabalhos.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {fotos.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={`${CATEGORIA_LABEL[f.categoria] ?? f.categoria} — foto ${
                      f.tipo === "ANTES" ? "antes" : "depois"
                    }`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
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
        )}
      </div>
    </section>
  );
}
