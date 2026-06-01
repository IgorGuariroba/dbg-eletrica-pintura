import type { Route } from "next";
import { dataCurta } from "@/portal/ui-helpers";
import { carregarOsAgendadaPortal } from "@/portal/carregar-os-agendada";
import { AcaoRestritaCard } from "@/features/portal/components/acao-restrita-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CancelarOsClientForm } from "./cancelar-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Cancelar OS ${id.slice(0, 8)} — Portal DBG` };
}

export default async function CancelarOsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { os, restrito } = await carregarOsAgendadaPortal(id, "cancelamento");

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
          titulo="Cancelamento Restrito"
          acaoPlural="cancelamentos"
          verbo="cancelar"
          osId={os.id}
          agendadoPara={os.agendadoPara}
        />
      ) : (
        <Card className="shadow-lg border-warning/20 bg-warning/[0.02]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Cancelar Visita Técnica</CardTitle>
                <CardDescription className="mt-1">
                  Confirme o cancelamento do agendamento planejado para o dia {dataCurta(os.agendadoPara)}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <CancelarOsClientForm osId={os.id} solicitacaoId={os.solicitacaoId} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
