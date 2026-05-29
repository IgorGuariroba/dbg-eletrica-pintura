import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { carregarParaCliente } from "@/operacao/aprovacao";
import { criarAprovacaoRepoDrizzle } from "@/operacao/aprovacao-repo-drizzle";
import { TokenInvalidoError } from "@/operacao/aprovacao-repo";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";
import { AcoesOrcamento } from "./acoes-orcamento";

export const metadata = {
  title: "Seu orçamento — DBG Elétrica e Pintura",
};

const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

const ESTADO: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  NOVA: { label: "Em análise", variant: "secondary" },
  ORCADA: { label: "Aguardando sua aprovação", variant: "default" },
  APROVADA: { label: "Aprovado", variant: "default" },
  REJEITADA: { label: "Recusado", variant: "destructive" },
  EXPIRADA: { label: "Expirado", variant: "outline" },
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
            const est = ESTADO[os.estado] ?? {
              label: os.estado,
              variant: "outline" as const,
            };
            return (
              <section key={os.id} className="rounded-lg border bg-background p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
                  </h2>
                  <Badge variant={est.variant}>{est.label}</Badge>
                </div>

                {os.orcamento && (
                  <div className="mt-4 space-y-2 text-sm">
                    <ul className="divide-y">
                      {os.orcamento.itens.map((it, i) => (
                        <li key={i} className="flex justify-between py-2">
                          <span>
                            {it.nome}
                            <span className="text-muted-foreground">
                              {" "}
                              × {Number(it.quantidade)}
                            </span>
                          </span>
                          <span>{formatBRL(it.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Deslocamento</span>
                      <span>{formatBRL(os.orcamento.totalDeslocamento)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base font-bold">
                      <span>Total</span>
                      <span>{formatBRL(os.orcamento.total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Válido até{" "}
                      {os.orcamento.validoAte.toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </p>

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
      </main>
      <SiteFooter />
    </>
  );
}
