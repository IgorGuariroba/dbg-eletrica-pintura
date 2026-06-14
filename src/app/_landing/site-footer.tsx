import Link from "next/link";
import type { Route } from "next";
import { Mail, MapPin } from "lucide-react";
import { REGIAO_ATENDIMENTO } from "@/lib/contato";

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

  return (
    // Fecho drenado em azul-confiança (primary-950): âncora escura no fim da
    // página, inverso do branco acima. Sempre dark nos dois temas, por isso o
    // texto é fixo em primary-foreground (branco em ambos), ~13:1 sobre o navy.
    <footer className="bg-primary-950 text-primary-foreground">
      {/* Seção principal */}
      <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-16 text-center md:grid-cols-[1.6fr_1fr_1fr_1.2fr] md:gap-10 md:py-20 md:text-left">
        {/* Marca — momento focal: wordmark grande + ponto de marca laranja */}
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            DBG Elétrica e Pintura
            <span
              className="ml-1.5 inline-block size-2 rounded-full bg-accent align-middle"
              aria-hidden
            />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-primary-foreground/70 text-pretty">
            Serviços residenciais de elétrica, pintura e drywall. Você aprova o
            preço antes do serviço, com garantia formal de mão de obra e fotos
            de antes e depois.
          </p>
        </div>

        {/* Links rápidos */}
        <nav className="flex flex-col gap-4" aria-label="Links rápidos">
          <h3 className="text-sm font-semibold text-primary-foreground">
            Links rápidos
          </h3>
          <ul className="space-y-2.5">
            {LINKS_NAVEGACAO.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Nossos serviços */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-primary-foreground">
            Nossos serviços
          </h3>
          <ul className="space-y-2.5">
            {NOSSOS_SERVICOS.map((s, i) => (
              <li key={i}>
                <span className="text-sm text-primary-foreground/70">
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contato */}
        <div className="flex flex-col items-center gap-4 md:items-start">
          <h3 className="text-sm font-semibold text-primary-foreground">
            Contato
          </h3>
          <div className="flex flex-col items-center gap-2.5 text-sm text-primary-foreground/70 md:items-start">
            <span className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary-foreground/50" />
              <span>{REGIAO_ATENDIMENTO}</span>
            </span>
            <span className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-primary-foreground/50" />
              <span>contato@dbg.com.br</span>
            </span>
            <span className="mt-1 text-primary-foreground/60">
              Segunda a Sábado · 8h às 18h
            </span>
          </div>
        </div>
      </div>

      {/* Áreas atendidas (bairros) */}
      {bairros.length > 0 && (
        <div className="border-t border-primary-foreground/10">
          <div className="container mx-auto max-w-5xl px-6 py-6 text-center md:text-left">
            <div className="mb-2 text-sm font-semibold text-primary-foreground">
              Bairros atendidos — {REGIAO_ATENDIMENTO}
            </div>
            <p className="text-sm leading-relaxed text-primary-foreground/60">
              {bairros.join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Linha inferior */}
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-primary-foreground/65 md:flex-row">
          <div>
            © {ano} DBG Elétrica e Pintura. Todos os direitos reservados.
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link
              href={"/servicos" as Route}
              className="transition-colors hover:text-primary-foreground"
            >
              Serviços
            </Link>
            <Link
              href={"/equipe" as Route}
              className="transition-colors hover:text-primary-foreground"
            >
              Equipe
            </Link>
            <Link
              href={"/planos" as Route}
              className="transition-colors hover:text-primary-foreground"
            >
              Planos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
