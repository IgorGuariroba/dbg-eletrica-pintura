import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signIn } from "@/auth";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { destinoPortal } from "@/portal/destino";
import { AssinarCta } from "@/features/assinatura/components/assinar-cta";
import { PlanoResumo } from "@/features/assinatura/components/plano-resumo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";

interface PageProps {
  params: Promise<{ slug: string }>;
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
            <PlanoResumo plano={plano} />
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
