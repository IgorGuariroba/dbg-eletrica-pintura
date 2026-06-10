import Link from "next/link";
import { MessageCircle, Star, Mail, MapPin } from "lucide-react";
import { urlWhatsApp, REGIAO_ATENDIMENTO } from "@/lib/contato";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS_NAVEGACAO = [
  { href: "/servicos", label: "Serviços e preços" },
  { href: "/#portfolio", label: "Trabalhos realizados" },
  { href: "/equipe", label: "Nossa equipe" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/planos", label: "Planos de manutenção" },
] as const;

const NOSSOS_SERVICOS = [
  { label: "Instalação Elétrica" },
  { label: "Pintura Residencial" },
  { label: "Drywall e Forros" },
  { label: "Iluminação LED" },
  { label: "Pequenos Reparos" },
  { label: "Manutenção Preventiva" },
] as const;

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

export function SiteFooter({ bairros = [] }: { bairros?: string[] }) {
  const ano = new Date().getFullYear();
  const msgOrcamento = "Olá! Gostaria de solicitar um orçamento com a DBG.";

  return (
    <footer className="border-t border-border bg-background text-sm">
      {/* Seção Principal */}
      <div className="container mx-auto px-6 py-16 max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-10 text-center md:text-left">
        
        {/* Coluna 1: Empresa e Redes */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="font-bold text-base text-foreground tracking-tight">
            DBG Elétrica e Pintura
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
            Serviços residenciais de elétrica, pintura e drywall de alto padrão.
            Preço fixo, garantia formal de mão de obra e documentação fotográfica de antes e depois.
          </p>
          {/* Redes Sociais */}
          <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="YouTube"
            >
              <YoutubeIcon />
            </a>
          </div>
        </div>

        {/* Coluna 2: Links Rápidos */}
        <div className="flex flex-col gap-3">
          <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Links Rápidos
          </div>
          <ul className="space-y-2">
            {LINKS_NAVEGACAO.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Coluna 3: Nossos Serviços */}
        <div className="flex flex-col gap-3">
          <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Nossos Serviços
          </div>
          <ul className="space-y-2">
            {NOSSOS_SERVICOS.map((s, i) => (
              <li key={i}>
                <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default">
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Coluna 4: Contato e Google Reviews */}
        <div className="flex flex-col items-center md:items-start gap-3">
          <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Contato
          </div>
          <div className="flex flex-col items-center md:items-start gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span>{REGIAO_ATENDIMENTO}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span>contato@dbg.com.br</span>
            </span>
          </div>

          {/* Horário e WhatsApp destacado */}
          <div className="w-full mt-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Segunda a Sábado · 8h às 18h
            </p>
            <a
              href={urlWhatsApp(msgOrcamento)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full gap-2 text-xs border-success/30 hover:border-success/60 text-success hover:bg-success/5 dark:text-success dark:hover:bg-success/10"
              )}
            >
              <MessageCircle className="size-4" />
              <span>Solicitar Orçamento</span>
            </a>
          </div>

          {/* Avaliações do Google */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground justify-center md:justify-start">
            <span className="font-semibold text-foreground text-[10px]">Google Rating</span>
            <div className="flex text-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3 fill-current text-current" />
              ))}
            </div>
            <span className="text-[10px] font-medium text-foreground">(4.9/5)</span>
          </div>
        </div>

      </div>

      {/* Áreas Atendidas (Bairros) Expandido */}
      {bairros.length > 0 && (
        <div className="border-t border-border/50 bg-muted/20">
          <div className="container mx-auto px-6 py-6 max-w-5xl text-center md:text-left">
            <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider mb-2">
              Bairros atendidos em São Paulo
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bairros.join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Linha Divisória de Baixo */}
      <div className="border-t border-border/70 py-8 bg-muted/40">
        <div className="container mx-auto px-6 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            © {ano} DBG Elétrica e Pintura. Todos os direitos reservados.
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="/politica-de-privacidade" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </a>
            <a href="/termos-de-uso" className="hover:text-foreground transition-colors">
              Termos de Uso
            </a>
            <a href="/cookies" className="hover:text-foreground transition-colors">
              Diretrizes de Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
