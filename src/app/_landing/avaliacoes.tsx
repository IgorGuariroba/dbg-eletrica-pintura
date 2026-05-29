import { Star } from "lucide-react";

const AVALIACOES = [
  {
    nome: "Mariana B.",
    texto:
      "Chegaram no horário, fizeram o serviço limpinho e ainda me mandaram fotos do antes e depois pelo WhatsApp.",
    nota: 5,
  },
  {
    nome: "Rodrigo S.",
    texto:
      "Preço fechado antes da visita. Sem aquele jogo de orçamento na hora. Recomendo.",
    nota: 5,
  },
  {
    nome: "Carla P.",
    texto:
      "Tive um problema 2 meses depois e a garantia foi acionada sem briga. Voltaram, resolveram, encerraram.",
    nota: 5,
  },
];

export function Avaliacoes() {
  return (
    <section className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">O que dizem</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          Avaliações coletadas após cada ordem de serviço concluída.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {AVALIACOES.map((a) => (
          <blockquote
            key={a.nome}
            className="rounded-lg border bg-card p-5 flex flex-col gap-3"
          >
            <div
              className="flex items-center gap-0.5"
              aria-label={`${a.nota} de 5 estrelas`}
            >
              {Array.from({ length: a.nota }).map((_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </div>
            <p className="text-sm">&ldquo;{a.texto}&rdquo;</p>
            <footer className="text-xs text-muted-foreground mt-auto">
              — {a.nome}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
