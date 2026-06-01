"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/utils";
import { CreditCard, CheckCircle2, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LABEL_CATEGORIA } from "@/operacao/rotulo-estado";
import { pagarOsAction, pagarTudoAction } from "./actions";

interface OrdemCheckout {
  osId: string;
  categoria: string;
  total: string;
  estado: string;
  pago: boolean;
}

interface SolicitacaoCheckoutView {
  token: string;
  clienteNome: string;
  cidade: string | null;
  uf: string | null;
  criadoEm: Date;
  ordens: OrdemCheckout[];
}

interface CheckoutConsolidado {
  pagaveis: { osId: string; total: string; categoria: string }[];
  pagas: { osId: string; total: string; categoria: string }[];
  somaPagavel: string;
  osIds: string[];
  podePagarTudo: boolean;
}

interface PagarViewProps {
  solicitacao: SolicitacaoCheckoutView;
  consolidado: CheckoutConsolidado;
}

export function PagarView({ solicitacao, consolidado }: PagarViewProps) {
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handlePagarIndividual = (osId: string) => {
    setLoadingAction(osId);
    startTransition(async () => {
      try {
        const res = await pagarOsAction(solicitacao.token, osId);
        if (res.erro) {
          toast.error(res.erro);
          setLoadingAction(null);
        } else if (res.url) {
          window.location.href = res.url;
        }
      } catch (e) {
        toast.error("Ocorreu um erro ao processar o seu pagamento.");
        setLoadingAction(null);
      }
    });
  };

  const handlePagarTudo = () => {
    setLoadingAction("tudo");
    startTransition(async () => {
      try {
        const res = await pagarTudoAction(solicitacao.token);
        if (res.erro) {
          toast.error(res.erro);
          setLoadingAction(null);
        } else if (res.url) {
          window.location.href = res.url;
        }
      } catch (e) {
        toast.error("Ocorreu um erro ao processar o seu pagamento.");
        setLoadingAction(null);
      }
    });
  };

  const totalFormatado = formatBRL(consolidado.somaPagavel);
  const totalPagaveis = consolidado.pagaveis.length;
  const totalPagas = consolidado.pagas.length;

  return (
    <div className="space-y-6">
      {/* Botão voltar para acompanhamento */}
      <div className="flex items-center justify-between">
        <Link
          href={`/s/${solicitacao.token}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft className="size-4" />
          Voltar para acompanhamento
        </Link>

        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-2.5 py-1 rounded-full border border-border/40">
          <ShieldCheck className="size-3.5 text-success" />
          Ambiente 100% Seguro
        </span>
      </div>

      {/* Lista de OSs */}
      <div className="space-y-4">
        {solicitacao.ordens.length === 0 ? (
          <Card className="border border-dashed py-8">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle2 className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum serviço pendente ou pago nesta solicitação.
              </p>
            </CardContent>
          </Card>
        ) : (
          solicitacao.ordens.map((os) => {
            const isLoading = isPending && loadingAction === os.osId;
            const isAnyLoading = isPending && loadingAction !== null;

            return (
              <Card
                key={os.osId}
                className={`transition-all duration-300 relative overflow-hidden ${
                  os.pago
                    ? "border-success/20 bg-success/5 hover:bg-success/10"
                    : "hover:border-primary/30 hover:shadow-sm"
                }`}
              >
                {/* Linha decorativa para itens pagos */}
                {os.pago && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-success/40" />
                )}

                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-4">
                  <div>
                    <CardTitle className={`text-base font-bold transition-all ${
                      os.pago ? "line-through text-muted-foreground" : "text-foreground"
                    }`}>
                      {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Código: {os.osId.slice(0, 8).toUpperCase()}
                    </CardDescription>
                  </div>

                  <Badge
                    variant={os.pago ? "default" : "secondary"}
                    className={
                      os.pago
                        ? "bg-success/10 text-success border border-success/20 shadow-none"
                        : "bg-warning/10 text-warning border border-warning/20 shadow-none"
                    }
                  >
                    {os.pago ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Pago
                      </span>
                    ) : (
                      "Aguardando Pagamento"
                    )}
                  </Badge>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Valor do serviço</span>
                    <span className={`text-lg font-extrabold ${os.pago ? "text-muted-foreground line-through" : "text-primary"}`}>
                      {formatBRL(os.total)}
                    </span>
                  </div>
                </CardContent>

                {!os.pago && (
                  <>
                    <Separator className="bg-border/60" />
                    <CardFooter className="pt-3 pb-3 flex justify-end">
                      <Button
                        onClick={() => handlePagarIndividual(os.osId)}
                        disabled={isAnyLoading}
                        className="w-full sm:w-auto min-h-[44px] px-6 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] gap-2 cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <CreditCard className="size-4" />
                            Pagar esta OS
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Caixa consolidada do rodapé */}
      {consolidado.podePagarTudo && (
        <Card className="border-primary/20 bg-primary/[0.01] shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/40" />
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-extrabold text-foreground">
              Resumo do Pagamento
            </CardTitle>
            <CardDescription className="text-xs">
              Pague {totalPagaveis} {totalPagaveis === 1 ? "serviço pendente" : "serviços pendentes"} de uma única vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Serviços pendentes ({totalPagaveis})</span>
              <span>{totalFormatado}</span>
            </div>
            {totalPagas > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Serviços já pagos ({totalPagas})</span>
                <span className="font-medium">Confirmado</span>
              </div>
            )}
            <Separator className="bg-primary/10" />
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold text-foreground">Valor Total a Pagar</span>
              <span className="text-2xl font-black text-primary tracking-tight">
                {totalFormatado}
              </span>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-6">
            <Button
              onClick={handlePagarTudo}
              disabled={isPending}
              size="lg"
              className="w-full min-h-[48px] text-base font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending && loadingAction === "tudo" ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Processando tudo...
                </>
              ) : (
                <>
                  <CreditCard className="size-5" />
                  Pagar tudo junto
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
