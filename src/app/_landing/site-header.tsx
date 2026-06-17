import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MenuMobile, type LinkNavegacao } from "./menu-mobile";

// "/#id" (não "#id"): o header aparece também em /servicos e /equipe,
// onde âncora sem path não navega de volta para a home.
const LINKS: LinkNavegacao[] = [
  { href: "/#servicos", label: "Serviços" },
  { href: "/#portfolio", label: "Portfólio" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#equipe", label: "Equipe" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center" aria-label="DBG — página inicial">
          <Image
            src="/logo-dbg.png"
            alt="DBG"
            width={96}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <nav
          aria-label="Navegação principal"
          className="hidden h-16 flex-1 items-center gap-5 pl-2 md:flex"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as Route}
              className="inline-flex h-16 items-center border-b-2 border-transparent text-sm font-semibold text-foreground/80 transition-colors hover:border-primary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden h-6 w-px bg-border md:block" aria-hidden />
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className={cn(
              buttonVariants({
                size: "sm",
                variant: "ghost",
                className: "rounded-full",
              }),
              "hidden md:inline-flex",
            )}
          >
            Entrar
          </Link>
          <Link
            href="/#orcamento"
            className={cn(
              buttonVariants({
                variant: "link",
              }),
              "h-11 px-2.5 md:h-8 md:px-3 text-sm font-semibold text-brand-ink hover:text-brand-ink/80 decoration-primary/40",
            )}
          >
            Solicitar orçamento
          </Link>
          <MenuMobile links={LINKS} />
        </div>
      </div>

    </header>
  );
}

