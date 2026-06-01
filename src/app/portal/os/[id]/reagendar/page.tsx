import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { ordemServico, solicitacao, cliente } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exigirPortal } from "@/portal/guard";
import { dentroDaJanelaCliente } from "@/operacao/reagendamento";
import { urlWhatsApp } from "@/lib/contato";
import { dataCurta } from "@/portal/ui-helpers";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, MessageSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReagendarOsClientForm } from "./reagendar-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Reagendar OS ${id.slice(0, 8)} — Portal DBG` };
}

export default async function ReagendarOsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Sem sessão Google: redirect direto para wa.me
  const session = await auth();
  if (!session?.user) {
    const link = urlWhatsApp(`Olá! Gostaria de solicitar o reagendamento da Ordem de Serviço #${id.slice(0, 8)}.`);
    redirect(link as Route);
  }

  // 2. Se logado, exige portal (valida WhatsApp etc.)
  const user = await exigirPortal();

  // 3. Carrega OS e valida propriedade
  const [os] = await db
    .select({
      id: ordemServico.id,
      estado: ordemServico.estado,
      agendadoPara: ordemServico.agendadoPara,
      solicitacaoId: ordemServico.solicitacaoId,
      clienteWhatsapp: cliente.whatsapp,
      categoria: ordemServico.categoria,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!os || os.clienteWhatsapp !== user.whatsapp) {
    notFound();
  }

  // Se não estiver agendada, volta ao portal
  if (os.estado !== "AGENDADA" || !os.agendadoPara) {
    redirect(`/portal/solicitacao/${os.solicitacaoId}` as Route);
  }

  const agora = new Date();
  const restrito = dentroDaJanelaCliente(new Date(os.agendadoPara), agora);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 md:py-16">
      <div className="mb-6">
        <Link
          href={`/portal/solicitacao/${os.solicitacaoId}` as Route}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "cursor-pointer" })}
        >
          <ArrowLeft className="mr-2 size-4" />
          Voltar para OS
        </Link>
      </div>

      {restrito ? (
        <Card className="border-destructive bg-destructive/5 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold text-destructive">Reagendamento Restrito</CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Esta visita está agendada para <strong>{dataCurta(os.agendadoPara)}</strong> (em menos de 24 horas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center text-sm md:text-base text-muted-foreground">
            <p>
              Por questões operacionais, reagendamentos com menos de 24 horas de antecedência não podem ser realizados de forma autônoma.
            </p>
            <p className="font-semibold text-foreground">
              Entre em contato conosco pelo WhatsApp para que possamos te ajudar com essa alteração.
            </p>
            <div className="pt-4">
              <Link
                href={urlWhatsApp(`Olá! Preciso reagendar a visita da OS #${os.id.slice(0, 8)} agendada para ${dataCurta(os.agendadoPara)}.`) as Route}
                className={buttonVariants({ variant: "destructive", size: "lg", className: "w-full font-bold shadow-md cursor-pointer min-h-[44px]" })}
              >
                <MessageSquare className="mr-2 size-5" />
                Falar com Atendimento
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg rounded-xl overflow-hidden border border-border/40">
          <CardHeader className="bg-gradient-to-br from-primary/5 via-transparent to-transparent pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Reagendar Serviço</CardTitle>
                <CardDescription className="mt-1">
                  Selecione um novo horário para a sua visita técnica.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ReagendarOsClientForm osId={os.id} solicitacaoId={os.solicitacaoId} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
