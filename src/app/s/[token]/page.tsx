import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { db } from "@/db/client";
import { carregarParaCliente } from "@/operacao/aprovacao";
import { criarAprovacaoRepoDrizzle } from "@/operacao/aprovacao-repo-drizzle";
import { TokenInvalidoError } from "@/operacao/aprovacao-repo";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";
import { AcoesOrcamento } from "./acoes-orcamento";
import { AgendarOs } from "./agendar-os";
import { EstouAqui } from "./estou-aqui";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { RecompensasAvaliacao } from "@/components/shared/recompensas-avaliacao";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo-drizzle";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";

export const metadata = {
  title: "Seu orçamento — DBG Elétrica e Pintura",
};

const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** Variante visual do badge por estado; rótulo vem de rotularEstadoCliente. */
const VARIANTE_ESTADO: Record<string, BadgeVariant> = {
  NOVA: "secondary",
  REJEITADA: "destructive",
  EXPIRADA: "outline",
  CANCELADA: "outline",
};

export default async function AcompanhamentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let view: Awaited<ReturnType<typeof carregarParaCliente>>;
  try {
    view = await carregarParaCliente(token, criarAprovacaoRepoDrizzle(db));
  } catch (e) {
    if (e instanceof TokenInvalidoError) notFound();
    throw e;
  }

  const avalRepo = criarAvaliacaoRepoDrizzle(db);
  const viewAval = await avalRepo.carregarPorToken(token);
  const configRepo = criarOperacaoConfigRepoDrizzle(db);
  const opConfig = await configRepo.obter();

  const qualificada =
    viewAval &&
    viewAval.ordens.length > 0 &&
    viewAval.ordens.every(
      (o) => o.avaliacao !== null && o.avaliacao.nota >= 4
    );
  const googleReviewUrl = qualificada ? (opConfig.googleReviewUrl ?? null) : null;

  const protocolo = token.slice(0, 8).toUpperCase();

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold md:text-3xl">
          Solicitação #{protocolo}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Olá, {view.clienteNome.split(" ")[0]}. Acompanhe abaixo o andamento e
          aprove os orçamentos.
          {view.cidade && ` · ${view.cidade}/${view.uf}`}
        </p>

        <div className="mt-8 space-y-6">
          {view.ordens.map((os) => {
            return (
              <section key={os.id} className="rounded-lg border bg-background p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
                  </h2>
                  <Badge variant={VARIANTE_ESTADO[os.estado] ?? "default"}>
                    {rotularEstadoCliente(os.estado)}
                  </Badge>
                </div>

                 {os.tecnico && (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 border shadow-sm">
                        {os.tecnico.fotoUrl && (
                          <AvatarImage src={os.tecnico.fotoUrl} alt={os.tecnico.nome} className="object-cover" />
                        )}
                        <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                          {os.tecnico.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground leading-none">Seu técnico</p>
                        <p className="font-semibold text-foreground mt-0.5">{os.tecnico.nome}</p>
                      </div>
                    </div>
                    {os.tecnico.slug && (
                      <Link
                        href={`/tecnico/${os.tecnico.slug}` as Route}
                        className={buttonVariants({ variant: "ghost", size: "sm", className: "text-xs font-semibold gap-1 text-primary hover:text-primary/85 hover:bg-primary/5 h-8 px-2" })}
                      >
                        Ver perfil <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                )}

                {os.estado === "APROVADA" && (
                  <div className="mt-4 flex flex-col gap-3 rounded-md bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Orçamento aprovado. Escolha o melhor horário para o
                      serviço.
                    </p>
                    <AgendarOs token={token} osId={os.id} />
                  </div>
                )}

                {os.estado === "AGENDADA" && os.agendadoPara && (
                  <div className="mt-4 flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
                    <CalendarCheck className="size-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Serviço agendado
                      </p>
                      <p className="text-muted-foreground capitalize">
                        {os.agendadoPara.toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                          timeZone: "America/Sao_Paulo",
                        })}
                        {" às "}
                        {os.agendadoPara.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {os.estado === "A_CAMINHO" && (
                  <div className="mt-4 space-y-3 rounded-md bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      O técnico está a caminho. Quando ele chegar, confirme
                      abaixo.
                    </p>
                    <EstouAqui token={token} osId={os.id} />
                  </div>
                )}

                {os.orcamento && (
                  <div className="mt-6 space-y-4 text-sm">
                    <div className="rounded-lg border border-border/80 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider">
                            <th className="p-3">Serviço</th>
                            <th className="p-3 text-center">Qtd</th>
                            <th className="p-3 text-right">Preço Base</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-foreground">
                          {os.orcamento.itens.map((it, i) => (
                            <tr key={i} className="hover:bg-muted/10 transition-colors">
                              <td className="p-3 font-medium">{it.nome}</td>
                              <td className="p-3 text-center">{Number(it.quantidade)}</td>
                              <td className="p-3 text-right">{formatBRL(it.precoUnitario)}</td>
                              <td className="p-3 text-right">{formatBRL(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 border-t pt-4 border-border">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Deslocamento</span>
                        <span>{formatBRL(os.orcamento.totalDeslocamento)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatBRL(os.orcamento.total)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-xs text-muted-foreground border-t pt-3 border-dashed border-border">
                      <span className="font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                        Preços fixos por serviço, sem surpresa
                      </span>
                      <span>
                        Válido até{" "}
                        {os.orcamento.validoAte.toLocaleDateString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </span>
                    </div>

                    {os.estado === "ORCADA" && (
                      <div className="pt-3">
                        <AcoesOrcamento token={token} osId={os.id} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {qualificada && (
          <section className="mt-8 rounded-lg border bg-success/5 border-success/20 p-6 flex flex-col items-center text-center space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Obrigado pelo seu apoio!</h2>
              <p className="text-xs text-muted-foreground max-w-md">
                Como todas as suas ordens de serviço foram avaliadas de forma positiva, você está qualificado para nossas ações especiais:
              </p>
            </div>

            <RecompensasAvaliacao googleReviewUrl={googleReviewUrl} />
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
