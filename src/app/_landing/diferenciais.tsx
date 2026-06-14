import { BadgeDollarSign, Camera, ShieldCheck, UserCheck } from "lucide-react";
import type { MetricasPublicas } from "@/marketing/landing/metricas-publicas-query";

// Abaixo destes mínimos o número joga contra (parece empresa recém-aberta):
// esconde a métrica individualmente em vez de exibir valor baixo.
const MIN_OS_CONCLUIDAS = 10;

const ITENS = [
  {
    icone: BadgeDollarSign,
    titulo: "Você aprova o preço antes",
    texto: "Sem cobrança a mais no final. O que você combinou é o que paga.",
  },
  {
    icone: ShieldCheck,
    titulo: "Garantia no papel",
    texto: "Deu problema no prazo, a gente volta e refaz sem cobrar.",
  },
  {
    icone: Camera,
    titulo: "Foto antes e depois",
    texto: "Chega no seu WhatsApp. Você vê o serviço pronto sem ter que fiscalizar.",
  },
  {
    icone: UserCheck,
    titulo: "Você vê quem vai te atender",
    texto: "Nome, foto e avaliação do técnico antes dele chegar na sua casa.",
  },
] as const;

export function Diferenciais({ metricas }: { metricas: MetricasPublicas }) {
  const mostrarConcluidas = metricas.osConcluidas >= MIN_OS_CONCLUIDAS;

  return (
    <section
      id="diferenciais"
      aria-label="Por que escolher a DBG"
      className="border-y bg-card scroll-mt-24"
    >
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-8">
        {mostrarConcluidas && (
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            <p className="flex items-center gap-2 text-sm">
              <strong className="text-lg font-mono font-bold">
                {metricas.osConcluidas}
              </strong>
              <span className="text-muted-foreground">
                serviços concluídos
              </span>
            </p>
          </div>
        )}

        {/* Lista de benefícios com ícone à esquerda (sem card) — diferencia da
            timeline de "Como funciona" e da grade de serviços. */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          {ITENS.map((item) => (
            <div key={item.titulo} className="flex gap-4">
              <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
                <item.icone className="size-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold">{item.titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {item.texto}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
