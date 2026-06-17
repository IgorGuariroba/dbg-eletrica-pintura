import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { urlWhatsApp } from "@/lib/contato";
import { cn } from "@/lib/utils";

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
    <section id="faq" className="container mx-auto px-4 py-16 md:py-24 max-w-5xl scroll-mt-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        {/* Esquerda: Conteúdo de Título e CTA (Bolder/Asymmetric) */}
        <div className="lg:col-span-5 flex flex-col justify-start gap-6">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.08] text-balance">
              Ainda com uma dúvida?
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              A gente responde tudo, sem enrolação. Se a sua dúvida não estiver aqui, é só chamar no WhatsApp.
            </p>
          </div>
          <div>
            <a
              href={urlWhatsApp("Olá! Vi o site de vocês e ainda tenho uma dúvida sobre os serviços.")}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto font-medium transition-colors"
              )}
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>

        {/* Direita: Acordeon de Perguntas Frequentes */}
        <div className="lg:col-span-7">
          <Accordion className="w-full">
            {PERGUNTAS.map((item) => (
              <AccordionItem key={item.p} value={item.p}>
                <AccordionTrigger className="text-left text-base font-semibold py-4 hover:no-underline">
                  {item.p}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {item.r}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

