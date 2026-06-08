import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Star } from "lucide-react";
import { auth, signIn } from "@/auth";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { destinoPortal } from "@/portal/destino";
import { AssinarCta } from "@/features/assinatura/components/assinar-cta";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function beneficiosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const plano = await criarPlanoRepoDrizzle(db).buscarPorSlug(slug);
  if (!plano) return { title: "Plano não encontrado | DBG" };
  return {
    title: `Assinar ${plano.nome} | DBG Elétrica e Pintura`,
    description: `Assine o plano ${plano.nome} e tenha manutenção preventiva recorrente com desconto e prioridade.`,
  };
}

export default async function AssinarPlanoPage({ params }: PageProps) {
  const { slug } = await params;
  const plano = await criarPlanoRepoDrizzle(db).buscarPorSlug(slug);
  if (!plano || !plano.ativo) notFound();

  const session = await auth();
  const destino = destinoPortal(session);
  const beneficios = beneficiosDe(plano.beneficios);
  const desconto = Number(plano.percentualDesconto);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container mx-auto max-w-lg px-4 py-12 md:py-16">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold md:text-3xl">
              Assinar {plano.nome}
            </h1>
            <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
              Manutenção preventiva recorrente, com desconto em todo orçamento e
              prioridade no agendamento.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{plano.nome}</span>
                {plano.prioridadeAgendamento && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="size-3" />
                    Prioridade
                  </Badge>
                )}
              </CardTitle>
              <p className="pt-2">
                <span className="text-3xl font-bold">
                  {formatBRL(plano.preco)}
                </span>
                <span className="text-sm text-muted-foreground"> / mês</span>
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {desconto > 0 && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{desconto.toFixed(0)}% de desconto em serviços</span>
                  </li>
                )}
                {plano.preventivasPorAno > 0 && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {plano.preventivasPorAno} visita
                      {plano.preventivasPorAno === 1 ? "" : "s"} preventiva
                      {plano.preventivasPorAno === 1 ? "" : "s"} por ano
                    </span>
                  </li>
                )}
                {beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-3">
              {destino === null ? (
                <AssinarCta slug={plano.slug!} nomePlano={plano.nome} />
              ) : destino === "/portal/vincular" ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Vincule seu WhatsApp para concluir a assinatura.
                  </p>
                  <Link
                    href={"/portal/vincular" as Route}
                    className={buttonVariants({ className: "w-full" })}
                  >
                    Vincular WhatsApp
                  </Link>
                </>
              ) : destino === "/painel" ? (
                <p className="text-center text-sm text-muted-foreground">
                  Entre com uma conta de cliente para assinar um plano.
                </p>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", {
                      redirectTo: `/assinar/${plano.slug}`,
                    });
                  }}
                  className="contents"
                >
                  <Button type="submit" size="lg" className="w-full">
                    Entrar com Google para assinar
                  </Button>
                </form>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Pagamento processado com segurança pelo Mercado Pago.
              </p>
            </CardFooter>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
