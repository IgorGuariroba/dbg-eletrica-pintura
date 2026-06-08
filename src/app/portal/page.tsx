import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight, CalendarClock, FileText, MapPin } from "lucide-react";
import { db } from "@/db/client";
import { exigirPortal } from "@/portal/guard";
import { listarHistoricoCliente } from "@/portal/historico";
import { criarHistoricoRepoDrizzle } from "@/portal/historico-repo-drizzle";
import { listarAssinaturasCliente } from "@/assinatura/listar-assinaturas-cliente";
import { MinhasAssinaturas } from "@/features/assinatura/components/minhas-assinaturas";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";
import { formatBRL } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LABEL_CATEGORIA, VARIANTE_ESTADO, dataCurta } from "@/portal/ui-helpers";

export const metadata = {
  title: "Portal do cliente — DBG Elétrica e Pintura",
};

function paginaAtual(valor: string | string[] | undefined) {
  const raw = Array.isArray(valor) ? valor[0] : valor;
  const page = Number(raw ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const user = await exigirPortal();
  const params = await searchParams;
  const page = paginaAtual(params.page);
  const limit = 20;
  const offset = (page - 1) * limit;
  const historico = await listarHistoricoCliente(
    user.whatsapp!,
    { limit, offset },
    criarHistoricoRepoDrizzle(db),
  );
  const totalPages = Math.max(1, Math.ceil(historico.total / limit));
  const assinaturas = await listarAssinaturasCliente(user.whatsapp!, db);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Histórico do cliente
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Acompanhe suas solicitações, ordens de serviço, orçamentos e documentos vinculados.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm">
          <div className="font-semibold">{historico.total}</div>
          <div className="text-muted-foreground">solicitações</div>
        </div>
      </div>

      {assinaturas.length > 0 && (
        <div className="mb-8">
          <MinhasAssinaturas assinaturas={assinaturas} />
        </div>
      )}

      {historico.itens.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma solicitação encontrada</CardTitle>
            <CardDescription>
              Quando você solicitar um serviço, o histórico aparecerá aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Accordion multiple className="gap-4">
          {historico.itens.map((solicitacao) => (
            <AccordionItem
              key={solicitacao.id}
              value={solicitacao.id}
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="min-h-16 gap-4 py-4 hover:no-underline">
                <div className="min-w-0 flex-1 space-y-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Solicitação #{solicitacao.protocolo}</span>
                    <Badge variant="outline">{solicitacao.ordens.length} OS</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>{dataCurta(solicitacao.criadoEm)}</span>
                    {solicitacao.cidade && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {solicitacao.cidade}/{solicitacao.uf}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {solicitacao.ordens.map((os) => (
                    <Card key={os.id} size="sm" className="rounded-lg">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle>{LABEL_CATEGORIA[os.categoria] ?? os.categoria}</CardTitle>
                            <CardDescription>
                              {os.agendadoPara ? `Agendada para ${dataCurta(os.agendadoPara)}` : "Aguardando agenda"}
                            </CardDescription>
                          </div>
                          <Badge variant={VARIANTE_ESTADO[os.estado] ?? "default"}>
                            {rotularEstadoCliente(os.estado)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {os.tecnico && (
                          <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="size-10 border">
                                {os.tecnico.fotoUrl && <AvatarImage src={os.tecnico.fotoUrl} alt={os.tecnico.nome} />}
                                <AvatarFallback>{os.tecnico.nome.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-medium">{os.tecnico.nome}</div>
                                <div className="text-xs text-muted-foreground">Técnico responsável</div>
                              </div>
                            </div>
                            {os.tecnico.slug && (
                              <Link
                                href={`/tecnico/${os.tecnico.slug}` as Route}
                                className={buttonVariants({ variant: "ghost", size: "sm" })}
                              >
                                Perfil
                              </Link>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg border bg-background p-3">
                            <div className="text-muted-foreground">Valor</div>
                            <div className="font-semibold">{os.orcamento ? formatBRL(os.orcamento.total) : "Em análise"}</div>
                          </div>
                          <div className="rounded-lg border bg-background p-3">
                            <div className="text-muted-foreground">Agenda</div>
                            <div className="inline-flex items-center gap-1 font-semibold">
                              <CalendarClock className="size-3.5" />
                              {os.agendadoPara ? dataCurta(os.agendadoPara) : "Pendente"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Link
                  href={`/portal/solicitacao/${solicitacao.id}` as Route}
                  className={buttonVariants({ className: "w-full sm:w-fit" })}
                >
                  <FileText className="size-4" />
                  Ver documentos e fotos
                </Link>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Link
          href={`/portal?page=${Math.max(1, page - 1)}` as Route}
          aria-disabled={page <= 1}
          className={buttonVariants({
            variant: "outline",
            className: page <= 1 ? "pointer-events-none opacity-50" : undefined,
          })}
        >
          <ArrowLeft className="size-4" />
          Anterior
        </Link>
        <span className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Link
          href={`/portal?page=${Math.min(totalPages, page + 1)}` as Route}
          aria-disabled={page >= totalPages}
          className={buttonVariants({
            variant: "outline",
            className: page >= totalPages ? "pointer-events-none opacity-50" : undefined,
          })}
        >
          Próxima
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </main>
  );
}
