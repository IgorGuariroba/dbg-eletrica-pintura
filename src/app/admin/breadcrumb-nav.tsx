"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABELS: Record<string, string> = {
  admin: "Admin",
  catalogo: "Catálogo",
  equipe: "Equipe",
  novo: "Novo",
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const partes = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {partes.map((parte, i) => {
          const href = ("/" + partes.slice(0, i + 1).join("/")) as Route;
          const ultimo = i === partes.length - 1;
          const label =
            LABELS[parte] ??
            (parte.length > 12 ? parte.slice(0, 8) + "…" : parte);
          return (
            <BreadcrumbItem key={href}>
              {i > 0 && <BreadcrumbSeparator />}
              {ultimo ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={href} />}>
                  {label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
