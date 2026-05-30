import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { carregarParaCliente } from "@/operacao/aprovacao";
import { criarAprovacaoRepoDrizzle } from "@/operacao/aprovacao-repo-drizzle";
import { TokenInvalidoError } from "@/operacao/aprovacao-repo";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";
import { SiteHeader } from "../../_landing/site-header";
import { SiteFooter } from "../../_landing/site-footer";
import { AcoesOrcamento } from "./acoes-orcamento";
import { EstouAqui } from "./estou-aqui";

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
              <section key={os.id} className="rounded-lg border bg-background p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
                  </h2>
                  <Badge variant={VARIANTE_ESTADO[os.estado] ?? "default"}>
                    {rotularEstadoCliente(os.estado)}
                  </Badge>
                </div>

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
