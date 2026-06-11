import Link from "next/link";
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
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 rounded-full border bg-background/80 pr-2 pl-5 shadow-lg backdrop-blur">
        <Link href="/" className="font-bold tracking-tight">
          DBG
        </Link>
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-1 md:flex"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as Route}
              className={buttonVariants({
                size: "sm",
                variant: "ghost",
                className: "rounded-full",
              })}
            >
              {link.label}
            </Link>
          ))}
        </nav>
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
            href="/solicitar"
            className={buttonVariants({
              variant: "gradient",
              className: "h-11 rounded-full px-4 md:h-8 md:px-3",
            })}
          >
            Solicitar orçamento
          </Link>
          <MenuMobile links={LINKS} />
        </div>
      </div>
    </header>
  );
}
