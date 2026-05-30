import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Route } from "next";
import { criarSolicitacaoRepoDrizzle } from "@/operacao/solicitacao-repo-drizzle";
import { db } from "@/db/client";
import { buttonVariants } from "@/components/ui/button";
import { urlWhatsApp } from "@/lib/contato";
import { SiteHeader } from "../../../_landing/site-header";
import { SiteFooter } from "../../../_landing/site-footer";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export const metadata = {
  title: "Solicitação enviada — DBG Elétrica e Pintura",
};

export default async function ConfirmacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const repo = criarSolicitacaoRepoDrizzle(db);
  const dados = await repo.buscarPorToken(token);
  if (!dados) notFound();

  const { solicitacao, ordens, cliente } = dados;
  const protocoloCurto = token.slice(0, 8).toUpperCase();
  const categoriasLabel = solicitacao.categorias
    .map((c) => LABEL_CATEGORIA[c] ?? c)
    .join(", ");
  const mensagem =
    `Olá! Acabei de enviar a solicitação #${protocoloCurto} ` +
    `(${categoriasLabel}). Pode confirmar o recebimento?`;

  const osComTecnico = ordens.find((o) => o.tecnicoId !== null);
  let tecnico = null;
  if (osComTecnico && osComTecnico.tecnicoId) {
    tecnico = await criarMembroRepoDrizzle(db).buscarPorId(osComTecnico.tecnicoId);
  }

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 max-w-xl text-center">
        <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-foreground/10">
          <CheckCircle2 className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">
          Solicitação #{protocoloCurto} criada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Obrigado, {cliente.nome.split(" ")[0]}. Recebemos seu pedido e vamos
          retornar pelo WhatsApp.
        </p>

        {tecnico && (
          <div className="mt-6 mx-auto max-w-sm rounded-lg border border-border/60 bg-muted/20 p-4 text-left text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border shadow-sm">
                {tecnico.fotoUrl && (
                  <AvatarImage src={tecnico.fotoUrl} alt={tecnico.nome} className="object-cover" />
                )}
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {tecnico.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground leading-none">Técnico Designado</p>
                <p className="font-semibold text-foreground mt-1">{tecnico.nome}</p>
              </div>
            </div>
            {tecnico.slug && (
              <Link
                href={`/tecnico/${tecnico.slug}` as Route}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "text-xs font-semibold gap-1 text-primary hover:text-primary/85 hover:bg-primary/5 h-8 px-2" })}
              >
                Ver perfil <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        )}

        <ul className="mt-6 inline-flex flex-col gap-2 text-left text-sm">
          <li>
            <strong>Categorias:</strong> {categoriasLabel}
          </li>
          <li>
            <strong>Ordens de serviço criadas:</strong> {ordens.length}
          </li>
          {solicitacao.dataDesejada && (
            <li>
              <strong>Data desejada:</strong>{" "}
              {solicitacao.dataDesejada.toLocaleDateString("pt-BR")}
            </li>
          )}
        </ul>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={urlWhatsApp(mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg" })}
          >
            Confirmar pelo WhatsApp
          </a>
          <Link
            href="/"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Voltar para o início
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Guarde este link — ele dá acesso à sua solicitação:
          <br />
          <code className="break-all">/s/{token}/confirmacao</code>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
