import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, CalendarClock, FileText, ImageIcon } from "lucide-react";
import { db } from "@/db/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { criarHistoricoRepoDrizzle } from "@/portal/historico-repo-drizzle";
import { exigirPortal } from "@/portal/guard";
import { carregarSolicitacaoDoCliente, fotosOsR2Port, montarDocumentosPortal, montarFotosOs } from "@/portal/historico";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";
import { formatBRL } from "@/lib/utils";
import { LABEL_CATEGORIA, VARIANTE_ESTADO, dataCurta } from "@/portal/ui-helpers";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Solicitação ${id.slice(0, 8)} — Portal DBG` };
}

export default async function PortalSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await exigirPortal();
  const { id } = await params;
  const solicitacao = await carregarSolicitacaoDoCliente(
    id,
    user.whatsapp!,
    criarHistoricoRepoDrizzle(db),
  );

  if (!solicitacao) notFound();

  const fotosPorOs = new Map(
    await Promise.all(
      solicitacao.ordens.map(async (os) => [os.id, await montarFotosOs(os.id, fotosOsR2Port())] as const),
    ),
  );
  const documentos = montarDocumentosPortal({ faturaKey: null, certificadoKey: null });

  return (
    <TooltipProvider>
      <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="mb-8 space-y-4">
          <Link href={"/portal" as Route} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Voltar ao histórico
          </Link>
          
          {/* Exibe o cabeçalho com botão de pagamento se houver OS concluída (pagável) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Solicitação #{solicitacao.protocolo}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                Criada em {dataCurta(solicitacao.criadoEm)}
                {solicitacao.cidade ? ` · ${solicitacao.cidade}/${solicitacao.uf}` : ""}
              </p>
            </div>
            {solicitacao.ordens.some((o) => o.estado === "CONCLUIDA") && (
              <Link
                href={`/s/${solicitacao.token}/pagar` as Route}
                className={buttonVariants({
                  variant: "default",
                  size: "lg",
                  className: "w-full sm:w-auto font-bold shadow-md cursor-pointer min-h-[44px]",
                })}
              >
                Pagar Serviços
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {solicitacao.ordens.map((os) => {
            const fotos = fotosPorOs.get(os.id) ?? { antes: [], depois: [] };
            return (
              <Card key={os.id} className="rounded-lg">
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle>{LABEL_CATEGORIA[os.categoria] ?? os.categoria}</CardTitle>
                      <CardDescription>
                        {os.agendadoPara ? `Agendada para ${dataCurta(os.agendadoPara)}` : "Agenda em definição"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={VARIANTE_ESTADO[os.estado] ?? "default"} className="w-fit">
                        {rotularEstadoCliente(os.estado)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <ImageIcon className="size-4" />
                        Fotos antes
                      </div>
                      {fotos.antes.length ? (
                        <div className="grid grid-cols-2 gap-3">
                          {fotos.antes.map((url) => (
                            <div key={url} className="relative aspect-video overflow-hidden rounded-lg border">
                              <Image src={url} alt="Foto antes do serviço" fill unoptimized className="object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                          Nenhuma foto antes disponível.
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <ImageIcon className="size-4" />
                        Fotos depois
                      </div>
                      {fotos.depois.length ? (
                        <div className="grid grid-cols-2 gap-3">
                          {fotos.depois.map((url) => (
                            <div key={url} className="relative aspect-video overflow-hidden rounded-lg border">
                              <Image src={url} alt="Foto depois do serviço" fill unoptimized className="object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                          Nenhuma foto depois disponível.
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">Orçamento</div>
                      {os.orcamento && (
                        <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarClock className="size-4" />
                          Válido até {dataCurta(os.orcamento.validoAte)}
                        </div>
                      )}
                    </div>
                    {os.orcamento ? (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serviço</TableHead>
                              <TableHead className="text-right">Qtd</TableHead>
                              <TableHead className="text-right">Unitário</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {os.orcamento.itens.map((item) => (
                              <TableRow key={`${os.id}-${item.nome}`}>
                                <TableCell className="font-medium whitespace-normal">{item.nome}</TableCell>
                                <TableCell className="text-right">{Number(item.quantidade)}</TableCell>
                                <TableCell className="text-right">{formatBRL(item.precoUnitario)}</TableCell>
                                <TableCell className="text-right">{formatBRL(item.subtotal)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={3} className="text-right text-muted-foreground">Deslocamento</TableCell>
                              <TableCell className="text-right">{formatBRL(os.orcamento.totalDeslocamento)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="text-right font-semibold text-primary">{formatBRL(os.orcamento.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                        Orçamento ainda não disponível.
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <FileText className="size-4" />
                      Documentos
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {documentos.map((documento) => (
                        <Tooltip key={documento.tipo}>
                          <TooltipTrigger
                            render={
                              documento.estado === "DISPONIVEL" && documento.url ? (
                                <Link href={documento.url as Route} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                                  {documento.rotulo}
                                </Link>
                              ) : (
                                <span className="block w-full" tabIndex={0}>
                                  <Button type="button" variant="outline" disabled className="w-full">
                                    {documento.rotulo}
                                  </Button>
                                </span>
                              )
                            }
                          />
                          {documento.tooltip && <TooltipContent>{documento.tooltip}</TooltipContent>}
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </TooltipProvider>
  );
}
