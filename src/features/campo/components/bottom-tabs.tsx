"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ClipboardList, ListChecks, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/campo", label: "Minhas OS", icon: ClipboardList },
  { href: "/campo/agenda", label: "Agenda", icon: Calendar },
  { href: "/campo/fila", label: "Fila", icon: ListChecks },
  { href: "/campo/perfil", label: "Perfil", icon: User },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t bg-background">
      {TABS.map((tab) => {
        const ativo =
          tab.href === "/campo"
            ? pathname === "/campo"
            : pathname.startsWith(tab.href);
        const Icone = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href as Route}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              ativo
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="size-6" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
