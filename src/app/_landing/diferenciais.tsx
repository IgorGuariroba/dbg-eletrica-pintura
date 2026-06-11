import { BadgeDollarSign, Camera, ShieldCheck, UserCheck, Star } from "lucide-react";
import type { MetricasPublicas } from "@/marketing/landing/metricas-publicas-query";

// Abaixo destes mínimos o número joga contra (parece empresa recém-aberta):
// esconde a métrica individualmente em vez de exibir valor baixo.
const MIN_OS_CONCLUIDAS = 10;
const MIN_AVALIACOES = 3;

const ITENS = [
  {
    icone: BadgeDollarSign,
    titulo: "Preço fixo",
    texto: "Você sabe o valor antes do técnico chegar.",
  },
  {
    icone: ShieldCheck,
    titulo: "Garantia formal",
    texto: "Mão de obra garantida, com certificado.",
  },
  {
    icone: Camera,
    titulo: "Fotos antes e depois",
    texto: "Registro do serviço direto no seu WhatsApp.",
  },
  {
    icone: UserCheck,
    titulo: "Técnico identificado",
    texto: "Você vê quem vai atender antes da visita.",
  },
] as const;

export function Diferenciais({ metricas }: { metricas: MetricasPublicas }) {
  const mostrarNota =
    metricas.notaMedia != null && metricas.totalAvaliacoes >= MIN_AVALIACOES;
  const mostrarConcluidas = metricas.osConcluidas >= MIN_OS_CONCLUIDAS;

  return (
    <section
      id="diferenciais"
      aria-label="Por que escolher a DBG"
      className="border-y bg-card scroll-mt-24"
    >
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-8">
        {(mostrarNota || mostrarConcluidas) && (
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {mostrarNota && (
              <p className="flex items-center gap-2 text-sm">
                <Star className="size-4 fill-primary text-primary" />
                <strong className="text-lg font-mono font-bold">
                  {metricas.notaMedia!.toFixed(1).replace(".", ",")}
                </strong>
                <span className="text-muted-foreground">
                  em {metricas.totalAvaliacoes} avaliações
                </span>
              </p>
            )}
            {mostrarConcluidas && (
              <p className="flex items-center gap-2 text-sm">
                <strong className="text-lg font-mono font-bold">
                  {metricas.osConcluidas}
                </strong>
                <span className="text-muted-foreground">
                  serviços concluídos
                </span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ITENS.map((item) => (
            <div
              key={item.titulo}
              className="flex flex-col items-start gap-2 rounded-lg border bg-background p-4"
            >
              <item.icone className="size-5 text-primary" aria-hidden />
              <h3 className="font-semibold text-sm">{item.titulo}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
