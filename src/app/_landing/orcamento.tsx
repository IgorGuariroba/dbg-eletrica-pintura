import { SolicitarForm } from "../solicitar/form";

// Form de orçamento embutido na landing (mesmo componente do /solicitar —
// reúso, sem duplicar). A página /solicitar segue existindo; aqui a Sandra
// pede sem sair da landing, com os motivos de confiar ao lado do form.
const MOTIVOS = [
  "Você aprova o preço antes de começar",
  "Garantia no papel",
  "Sem adiantamento — paga no final",
  "Resposta rápida no WhatsApp",
];

export function Orcamento({ bairros }: { bairros: string[] }) {
  return (
    <section id="orcamento" className="border-t bg-muted scroll-mt-20">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.1fr]">

          {/* Persuasão: por que pedir agora (motivos verdadeiros) */}
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground text-balance">
              Pronto para resolver? Peça seu orçamento.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              Você aprova o preço antes e só paga no final. Leva 2 minutos, sem compromisso.
            </p>
            <ul className="mt-6 space-y-3">
              {MOTIVOS.map((motivo) => (
                <li key={motivo} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-brand-ink">
                    ✓
                  </span>
                  <span className="font-medium text-foreground">{motivo}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* O form em si (componente reusado do /solicitar) */}
          <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <SolicitarForm bairrosAtendidos={bairros} />
          </div>

        </div>
      </div>
    </section>
  );
}
