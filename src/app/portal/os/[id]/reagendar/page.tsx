import type { Route } from "next";
import { carregarOsAgendadaPortal } from "@/portal/carregar-os-agendada";
import { AcaoRestritaCard } from "@/features/portal/components/acao-restrita-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft } from "lucide-react";
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
  const { os, restrito } = await carregarOsAgendadaPortal(id, "reagendamento");

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
        <AcaoRestritaCard
          titulo="Reagendamento Restrito"
          acaoPlural="reagendamentos"
          verbo="reagendar"
          osId={os.id}
          agendadoPara={os.agendadoPara}
        />
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
