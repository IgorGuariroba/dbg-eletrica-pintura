import { Smartphone, BadgeDollarSign, Wrench, ShieldCheck } from "lucide-react";

const PASSOS = [
  {
    icone: Smartphone,
    titulo: "Peça online",
    texto: "2 minutos, sem ligação.",
  },
  {
    icone: BadgeDollarSign,
    titulo: "Receba o preço fixo",
    texto: "Confirmado antes da visita.",
  },
  {
    icone: Wrench,
    titulo: "Técnico executa",
    texto: "Você acompanha cada etapa.",
  },
  {
    icone: ShieldCheck,
    titulo: "Fotos + garantia",
    texto: "Antes/depois e certificado.",
  },
] as const;

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="container mx-auto px-4 py-16 max-w-5xl"
    >
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold">Como funciona</h2>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PASSOS.map((passo, i) => (
          <li
            key={passo.titulo}
            className="relative rounded-lg border bg-card p-5 flex flex-col items-center text-center gap-3"
          >
            <span
              className="absolute top-3 left-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold"
              aria-hidden
            >
              {i + 1}
            </span>
            <passo.icone className="size-7 text-primary mt-2" aria-hidden />
            <h3 className="font-semibold text-sm">{passo.titulo}</h3>
            <p className="text-xs text-muted-foreground">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
