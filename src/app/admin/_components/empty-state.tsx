import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: { label: string; href: Route };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{titulo}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">{descricao}</p>
      {acao && (
        <Link href={acao.href} className={`${buttonVariants()} mt-4`}>
          {acao.label}
        </Link>
      )}
    </div>
  );
}
