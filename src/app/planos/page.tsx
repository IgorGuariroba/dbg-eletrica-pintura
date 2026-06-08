import type { Metadata, Route } from "next";
import Link from "next/link";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { urlWhatsApp } from "@/lib/contato";
import { PlanoResumo } from "@/features/assinatura/components/plano-resumo";
import { SiteHeader } from "../_landing/site-header";
import { SiteFooter } from "../_landing/site-footer";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Planos de Assinatura | DBG Elétrica e Pintura",
  description:
    "Manutenção preventiva recorrente com desconto em serviços e prioridade no agendamento.",
};

async function carregarPlanos() {
  try {
    return await criarPlanoRepoDrizzle(db).listarAtivos();
  } catch (err) {
    // SSG/ISR: o build pode rodar sem DB acessível — degrada para lista vazia
    // (revalida quando o DB volta), em vez de quebrar o prerender.
    console.error("Erro ao carregar planos:", err);
    return [];
  }
}

export default async function PlanosPage() {
  const planos = await carregarPlanos();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container mx-auto max-w-5xl px-4 py-16">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold md:text-4xl">
              Planos de Assinatura
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Manutenção preventiva recorrente, com desconto em todo orçamento e
              prioridade no agendamento.
            </p>
          </div>

          {planos.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Em breve novos planos disponíveis.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {planos.map((p) => {
                return (
                  <Card key={p.id} className="flex flex-col">
                    <PlanoResumo plano={p} />
                    <CardFooter>
                      {p.slug ? (
                        <Link
                          href={`/assinar/${p.slug}` as Route}
                          className={buttonVariants({ className: "w-full" })}
                        >
                          Assinar {p.nome}
                        </Link>
                      ) : (
                        <Link
                          href={
                            urlWhatsApp(
                              `Olá! Tenho interesse no plano ${p.nome}.`,
                            ) as Route
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ className: "w-full" })}
                        >
                          Assinar {p.nome}
                        </Link>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
