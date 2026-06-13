import { Zap, Paintbrush, RotateCcw } from "lucide-react";

const CENARIOS = [
  {
    icone: Zap,
    texto: "O disjuntor cai toda hora e você não sabe se é coisa boba ou perigo.",
  },
  {
    icone: Paintbrush,
    texto: "Precisa pintar antes da mudança e tem medo de errar e perder tempo.",
  },
  {
    icone: RotateCcw,
    texto: "Já teve uma experiência ruim e agora pensa duas vezes antes de chamar.",
  },
] as const;

export function Empatia() {
  return (
    <section className="border-b bg-card">
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-8">
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Cansada de chamar alguém e se arrepender?
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mx-auto">
            Aceitar um preço de boca e a conta vir maior. Esperar o dia todo e
            ninguém aparecer. Ou ficar com um aperto no peito sem saber quem
            entrou na sua casa. A gente sabe como é — por isso a DBG funciona ao
            contrário.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {CENARIOS.map((c) => (
            <li
              key={c.texto}
              className="flex flex-col gap-2 rounded-lg border bg-background p-4"
            >
              <c.icone className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {c.texto}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
