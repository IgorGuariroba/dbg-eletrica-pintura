import type { Metadata, Route } from "next";
import Link from "next/link";
import { Check, Star } from "lucide-react";
import { db } from "@/db/client";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { urlWhatsApp } from "@/lib/contato";
import { SiteHeader } from "../_landing/site-header";
import { SiteFooter } from "../_landing/site-footer";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Planos de Assinatura | DBG Elétrica e Pintura",
  description:
    "Manutenção preventiva recorrente com desconto em serviços e prioridade no agendamento.",
};

function beneficiosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

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
                const beneficios = beneficiosDe(p.beneficios);
                const desconto = Number(p.percentualDesconto);
                return (
                  <Card key={p.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        <span>{p.nome}</span>
                        {p.prioridadeAgendamento && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="size-3" />
                            Prioridade
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="pt-2">
                        <span className="text-3xl font-bold">
                          {formatBRL(p.preco)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {" "}
                          / mês
                        </span>
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2 text-sm">
                        {desconto > 0 && (
                          <li className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>
                              {desconto.toFixed(0)}% de desconto em serviços
                            </span>
                          </li>
                        )}
                        {p.preventivasPorAno > 0 && (
                          <li className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>
                              {p.preventivasPorAno} visita
                              {p.preventivasPorAno === 1 ? "" : "s"} preventiva
                              {p.preventivasPorAno === 1 ? "" : "s"} por ano
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
                    <CardFooter>
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
