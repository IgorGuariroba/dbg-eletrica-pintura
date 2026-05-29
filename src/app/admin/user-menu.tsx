"use client";

import { useEffect, useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "./session-actions";

function iniciais(nome: string | null | undefined) {
  if (!nome) return "?";
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Alternar tema"
        onClick={() => setTheme(dark ? "light" : "dark")}
        suppressHydrationWarning
      >
        {!mounted ? (
          <Sun className="opacity-0" />
        ) : dark ? (
          <Sun />
        ) : (
          <Moon />
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon" variant="ghost" className="rounded-full" />
          }
        >
          <Avatar className="size-7">
            {image && <AvatarImage src={image} alt={name ?? "user"} />}
            <AvatarFallback>{iniciais(name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{name ?? "Usuário"}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem
              nativeButton
              render={<button type="submit" className="w-full text-left" />}
            >
              <LogOut className="mr-2 size-4" />
              Sair
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
