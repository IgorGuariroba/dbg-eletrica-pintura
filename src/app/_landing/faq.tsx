import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

// Perguntas na voz desconfiada da cliente; respostas honestas e curtas.
// Só promete o que a operação entrega de verdade (sem "antecedente
// verificado", sem "preço imutável").
const PERGUNTAS = [
  {
    p: "Nunca ouvi falar de vocês. Como sei que são confiáveis?",
    r: "Somos uma empresa com CNPJ, garantia por escrito e avaliações reais de quem já atendemos. Você vê o nome e a foto do técnico antes da visita, e pedir orçamento não custa nada.",
  },
  {
    p: "Pedir orçamento me obriga a alguma coisa?",
    r: "Nada. É de graça e sem compromisso. Você só paga se aprovar o preço.",
  },
  {
    p: "Vão ficar me ligando pra empurrar serviço?",
    r: "Não. Você recebe o preço e decide na sua hora, sem ligação insistente.",
  },
  {
    p: "O preço pode aumentar depois que o serviço começa?",
    r: "O orçamento que você aprovou é o que você paga. Se o técnico encontrar algo a mais que não dava pra prever, ele te mostra e você decide antes — nada entra na conta sem a sua aprovação.",
  },
  {
    p: "Quem vai entrar na minha casa?",
    r: "Você vê a foto, o nome e a nota das avaliações do técnico antes dele chegar. Nada de estranho sem rosto.",
  },
  {
    p: "E se eu não gostar do serviço?",
    r: "Deu problema dentro do prazo da garantia, a gente volta e refaz sem cobrar. Você recebe o certificado por escrito.",
  },
  {
    p: "Como eu pago? Tem que adiantar?",
    r: "Você paga só na conclusão, por Pix ou link. Sem adiantamento.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="container mx-auto px-4 py-16 max-w-3xl scroll-mt-24">
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Ainda com uma dúvida?
        </h2>
      </div>
      <Accordion className="w-full">
        {PERGUNTAS.map((item) => (
          <AccordionItem key={item.p} value={item.p}>
            <AccordionTrigger className="text-left text-base">
              {item.p}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              {item.r}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
