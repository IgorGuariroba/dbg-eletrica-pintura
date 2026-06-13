import Link from "next/link";
import type { Route } from "next";
import { MessageCircle, Mail, MapPin } from "lucide-react";
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

export function SiteFooter({ bairros = [] }: { bairros?: string[] }) {
  const ano = new Date().getFullYear();
  const msgOrcamento = "Olá! Gostaria de solicitar um orçamento com a DBG.";

  return (
    <footer className="border-t border-border bg-background text-sm">
      {/* Seção Principal */}
      <div className="container mx-auto px-6 py-16 max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-10 text-center md:text-left">
        {/* Coluna 1: Empresa */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="font-bold text-base text-foreground tracking-tight">
            DBG Elétrica e Pintura
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
            Serviços residenciais de elétrica, pintura e drywall. Você aprova o
            preço antes do serviço, com garantia formal de mão de obra e fotos
            de antes e depois.
          </p>
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

        {/* Coluna 4: Contato */}
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
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
        </div>
      </div>

      {/* Áreas Atendidas (Bairros) Expandido */}
      {bairros.length > 0 && (
        <div className="border-t border-border/50 bg-muted/20">
          <div className="container mx-auto px-6 py-6 max-w-5xl text-center md:text-left">
            <div className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">
              Bairros atendidos — {REGIAO_ATENDIMENTO}
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
            <Link
              href={"/servicos" as Route}
              className="hover:text-foreground transition-colors"
            >
              Serviços
            </Link>
            <Link
              href={"/equipe" as Route}
              className="hover:text-foreground transition-colors"
            >
              Equipe
            </Link>
            <Link
              href={"/planos" as Route}
              className="hover:text-foreground transition-colors"
            >
              Planos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
