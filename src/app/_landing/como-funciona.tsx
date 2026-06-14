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
      className="container mx-auto px-4 py-16 max-w-5xl scroll-mt-24"
    >
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Como funciona</h2>
      </div>
      {/* Sequência ordenada real → timeline conectada (não card-grid). A linha
          horizontal liga os números no desktop; os círculos sólidos a mascaram. */}
      <ol className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4">
        {PASSOS.map((passo, i) => (
          <li
            key={passo.titulo}
            className="relative flex flex-col items-center gap-3 text-center"
          >
            {i < PASSOS.length - 1 && (
              <span
                className="absolute left-1/2 top-5 hidden h-px w-full bg-border lg:block"
                aria-hidden
              />
            )}
            <span className="relative flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <passo.icone className="size-6 text-primary" aria-hidden />
            <h3 className="text-sm font-semibold">{passo.titulo}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {passo.texto}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
