import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-5xl">
        <Link href="/" className="font-bold tracking-tight">
          DBG
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Entrar
          </Link>
          <Link
            href="/solicitar"
            className={buttonVariants({ size: "sm" })}
          >
            Solicitar orçamento
          </Link>
        </nav>
      </div>
    </header>
  );
}
