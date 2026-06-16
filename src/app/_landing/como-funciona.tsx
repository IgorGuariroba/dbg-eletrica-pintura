import { Smartphone, BadgeDollarSign, Wrench, ShieldCheck } from "lucide-react";

const PASSOS = [
  {
    icone: Smartphone,
    titulo: "Você conta o problema",
    texto: "Pelo celular, em 2 minutos. Sem ligação, sem compromisso.",
  },
  {
    icone: BadgeDollarSign,
    titulo: "Você aprova o orçamento",
    texto: "Recebe o preço antes e decide. Não gostou, não paga nada.",
  },
  {
    icone: Wrench,
    titulo: "O técnico resolve",
    texto: "Você vê quando ele sai e quando chega na sua casa.",
  },
  {
    icone: ShieldCheck,
    titulo: "Você recebe a prova",
    texto: "Foto antes e depois no WhatsApp e garantia no papel.",
  },
] as const;

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="container mx-auto px-4 py-20 max-w-5xl scroll-mt-24"
    >
      <div className="mb-12 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Como funciona
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Passo a passo simples e transparente, sem enrolação e sem surpresas.
        </p>
      </div>

      {/* Mobile view (< md): Left-aligned vertical timeline */}
      <ol className="relative border-l border-border ml-4 md:hidden flex flex-col gap-8">
        {PASSOS.map((passo, i) => (
          <li key={passo.titulo} className="relative pl-8 group">
            <span className="absolute -left-4 top-0.5 flex size-8 items-center justify-center rounded-full bg-background ring-1 ring-border text-sm font-semibold text-brand-ink transition-colors group-hover:ring-primary group-hover:text-primary-foreground group-hover:bg-primary">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <passo.icone className="size-5 text-brand-ink" aria-hidden />
                <h3 className="text-base font-semibold text-foreground">{passo.titulo}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {passo.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop/Tablet view (>= md): Connected, flat-by-honesty hover-lift cards */}
      <ol className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {PASSOS.map((passo, i) => (
          <li
            key={passo.titulo}
            className="group relative bg-card ring-1 ring-foreground/10 rounded-xl p-6 transition-all duration-200 hover:ring-primary/20 hover:-translate-y-0.5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold font-mono text-brand-ink/30 group-hover:text-brand-ink transition-colors">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="p-2 rounded-lg bg-primary/5 text-brand-ink group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                <passo.icone className="size-5" aria-hidden />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-foreground leading-tight">
                {passo.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {passo.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

