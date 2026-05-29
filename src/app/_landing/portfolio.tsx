const ITENS = [
  { titulo: "Pintura interna", descricao: "Sala de estar repintada em 1 dia" },
  { titulo: "Instalação elétrica", descricao: "Quadro reorganizado + 6 pontos" },
  { titulo: "Drywall", descricao: "Divisória em ambiente integrado" },
];

export function Portfolio() {
  return (
    <section className="bg-muted">
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Portfólio</h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            Fotos antes e depois de cada serviço, com permissão do cliente.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ITENS.map((i) => (
            <article
              key={i.titulo}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <div className="aspect-square bg-gradient-to-br from-muted to-card" />
              <div className="p-4">
                <h3 className="font-medium">{i.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {i.descricao}
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Galeria completa em breve. Por ora, mostramos exemplos representativos.
        </p>
      </div>
    </section>
  );
}
