import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { carregarGestaoAssinatura } from "@/assinatura/gestao-assinatura-loader";
import { db } from "@/db/client";
import { exigirPortal } from "@/portal/guard";
import { GestaoAssinaturaView } from "@/features/assinatura/components/gestao-assinatura-view";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Minha assinatura — DBG Elétrica e Pintura",
};

export default async function GestaoAssinaturaPage() {
  const user = await exigirPortal();
  const gestao = await carregarGestaoAssinatura(user.whatsapp!, db);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 md:py-12">
      <div className="mb-8 space-y-2">
        <Link
          href={"/portal" as Route}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "-ml-2 mb-2 w-fit",
          })}
        >
          <ArrowLeft className="size-4" />
          Voltar ao portal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Minha assinatura
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
          Gerencie seu plano: faça upgrade, agende um downgrade ou cancele.
        </p>
      </div>

      {gestao ? (
        <GestaoAssinaturaView gestao={gestao} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma assinatura ativa</CardTitle>
            <CardDescription>
              Quando você assinar um plano, as opções de gestão aparecerão aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
