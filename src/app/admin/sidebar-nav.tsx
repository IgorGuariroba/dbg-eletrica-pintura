"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Boxes, ClipboardList, LayoutDashboard, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface Item {
  label: string;
  href: Route;
  icon: typeof Boxes;
  modulo?: string;
}

const ITENS: Item[] = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard },
  { label: "Fila de OS", href: "/painel/fila", icon: ClipboardList, modulo: "OPERACAO" },
  { label: "Catálogo", href: "/admin/catalogo", icon: Boxes, modulo: "CATALOGO" },
  { label: "Equipe", href: "/admin/equipe", icon: Users, modulo: "EQUIPE" },
];

export function AdminSidebarNav({
  modulos,
  isAdminRaiz,
}: {
  modulos: string[];
  isAdminRaiz: boolean;
}) {
  const pathname = usePathname();
  const visiveis = ITENS.filter(
    (i) => !i.modulo || isAdminRaiz || modulos.includes(i.modulo),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/admin" className="px-2 py-1.5">
          <span className="font-bold text-sm">DBG Admin</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiveis.map((i) => {
                const ativo =
                  i.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(i.href);
                return (
                  <SidebarMenuItem key={i.href}>
                    <SidebarMenuButton
                      render={<Link href={i.href} />}
                      isActive={ativo}
                      tooltip={i.label}
                    >
                      <i.icon />
                      <span>{i.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
