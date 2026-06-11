"use client";

import Link from "next/link";
import type { Route } from "next";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type LinkNavegacao = { href: string; label: string };

export function MenuMobile({ links }: { links: LinkNavegacao[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            size="icon-lg"
            variant="ghost"
            className="size-11 rounded-full md:hidden"
          />
        }
      >
        <Menu />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Menu móvel" className="flex flex-col gap-1 px-4">
          {links.map((link) => (
            <SheetClose
              key={link.href}
              render={
                <Link
                  href={link.href as Route}
                  className={buttonVariants({
                    size: "lg",
                    variant: "ghost",
                    className: "h-11 justify-start",
                  })}
                />
              }
            >
              {link.label}
            </SheetClose>
          ))}
          <SheetClose
            render={
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  variant: "ghost",
                  className: "h-11 justify-start",
                })}
              />
            }
          >
            Entrar
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
