import type { Servico } from "@/catalogo/servico-repo";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ServicosCategoria } from "./servicos-categoria";
import {
  ORDEM_CATEGORIA,
  LABEL_CATEGORIA,
  ICONE_CATEGORIA,
  ANCORA_CATEGORIA,
} from "./servicos-grid.constants";

interface Props {
  servicos: Servico[];
  /**
   * Quais categorias já vêm abertas no acordeão. "primeira" (landing —
   * carga cognitiva baixa) ou "todas" (página /servicos, catálogo completo).
   */
  aberturaInicial?: "primeira" | "todas";
  titulo?: string;
  descricao?: string;
}

export function ServicosGrid({
  servicos,
  aberturaInicial = "primeira",
  titulo = "O que a gente resolve na sua casa",
  descricao = "Os preços abaixo são de referência. O valor exato você aprova no orçamento, antes do serviço começar.",
}: Props) {
  const porCategoria = new Map<Servico["categoria"], Servico[]>();
  for (const s of servicos) {
    const arr = porCategoria.get(s.categoria) ?? [];
    arr.push(s);
    porCategoria.set(s.categoria, arr);
  }

  if (servicos.length === 0) {
    return null;
  }

  const categorias = ORDEM_CATEGORIA.filter((c) => porCategoria.has(c));
  const ancoras = categorias.map((c) => ANCORA_CATEGORIA[c]);
  const defaultAbertas =
    aberturaInicial === "todas" ? ancoras : ancoras.slice(0, 1);

  return (
    <section
      id="servicos"
      className="container mx-auto px-4 py-16 max-w-5xl scroll-mt-24"
    >
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{titulo}</h2>
        <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-2xl text-pretty">
          {descricao}
        </p>
      </div>

      <Accordion defaultValue={defaultAbertas}>
        {categorias.map((cat) => {
          const items = porCategoria.get(cat)!;
          const IconeCat = ICONE_CATEGORIA[cat];
          return (
            <AccordionItem
              key={cat}
              value={ANCORA_CATEGORIA[cat]}
              id={ANCORA_CATEGORIA[cat]}
              className="scroll-mt-24"
            >
              <AccordionTrigger className="items-center py-4 text-base">
                <span className="flex items-center gap-2 font-semibold">
                  <IconeCat className="size-5 text-brand-ink" aria-hidden />
                  {LABEL_CATEGORIA[cat]}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </span>
              </AccordionTrigger>
              {/* [&_a]:no-underline neutraliza o sublinhado que o AccordionContent
                  aplica a qualquer <a> — os cards-link não devem ficar sublinhados. */}
              <AccordionContent className="[&_a]:no-underline">
                <ServicosCategoria categoria={cat} servicos={items} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
