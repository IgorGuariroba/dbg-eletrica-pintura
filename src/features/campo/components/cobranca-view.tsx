"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Send, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCampoDb } from "@/features/campo/db";
import { formatBRL } from "@/lib/utils";
import { gerarPixAction, gerarLinkAction, registrarManualAction } from "@/app/campo/os/[id]/cobranca/actions";

interface Props {
  osId: string;
  estadoInicial: string;
  valorTotal: string;
  categoria: string;
  clienteNome: string;
}

export function CobrancaView({ osId, estadoInicial, valorTotal, categoria, clienteNome }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [activeTab, setActiveTab] = useState("pix");
  
  // Pix state
  const [loadingPix, setLoadingPix] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [copiaCola, setCopiaCola] = useState<string | null>(null);
  
  // Link state
  const [loadingLink, setLoadingLink] = useState(false);
  const [urlWaMe, setUrlWaMe] = useState<string | null>(null);

  // Manual payment state
  const [valorManual, setValorManual] = useState(valorTotal);
  const [metodoManual, setMetodoManual] = useState("DINHEIRO");
  const [observacao, setObservacao] = useState("");
  const [erroManual, setErroManual] = useState<string | null>(null);
  const [pendingManual, startManualTransition] = useTransition();

  // Network state
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });

  // Polling state
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Polling para verificar se o estado da OS mudou para PAGA
  const verificarEstadoServidor = useCallback(async (silent = false) => {
    if (!silent) setCheckingStatus(true);
    try {
      const res = await fetch(`/api/campo/os/${osId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.estado === "PAGA") {
          setEstado("PAGA");
          toast.success("Pagamento confirmado!");
        } else if (!silent && data.estado !== estado) {
          setEstado(data.estado);
        }
      }
    } catch (e) {
      console.error("Erro ao verificar status da OS:", e);
    } finally {
      if (!silent) setCheckingStatus(false);
    }
  }, [estado, osId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (estado === "PAGA") return;

    const interval = setInterval(async () => {
      await verificarEstadoServidor(true);
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [estado, verificarEstadoServidor]);

  async function handleGerarPix() {
    if (!isOnline) {
      toast.error("Sem conexão com a internet para gerar Pix");
      return;
    }
    setLoadingPix(true);
    try {
      const res = await gerarPixAction(osId);
      if (res.erro) {
        toast.error(res.erro);
      } else if (res.qrBase64 && res.copiaCola) {
        setQrBase64(res.qrBase64);
        setCopiaCola(res.copiaCola);
        toast.success("QR Code Pix gerado!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar Pix");
    } finally {
      setLoadingPix(false);
    }
  }

  async function handleGerarLink() {
    if (!isOnline) {
      toast.error("Sem conexão com a internet para gerar link");
      return;
    }
    setLoadingLink(true);
    try {
      const res = await gerarLinkAction(osId);
      if (res.erro) {
        toast.error(res.erro);
      } else if (res.urlWaMe) {
        setUrlWaMe(res.urlWaMe);
        toast.success("Link gerado!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
    } finally {
      setLoadingLink(false);
    }
  }

  function handleCopyCopiaCola() {
    if (copiaCola) {
      navigator.clipboard.writeText(copiaCola);
      toast.success("Código Copia e Cola copiado!");
    }
  }

  function handleRegistrarManual() {
    setErroManual(null);
    const num = parseFloat(valorManual);
    if (isNaN(num) || num <= 0) {
      setErroManual("Informe um valor maior que zero");
      return;
    }

    if (!isOnline) {
      startManualTransition(async () => {
        try {
          await getCampoDb().fila_sync.add({
            tipo: "PAGAMENTO_MANUAL",
            payload: {
              osId,
              valor: valorManual,
              metodo: metodoManual,
              observacao: observacao || undefined,
            },
            criadoEm: new Date().toISOString(),
            tentativas: 0,
          });
          toast.success("Pagamento registrado offline — sincroniza ao voltar o sinal");
          router.push(`/campo/os/${osId}` as Route);
        } catch (err) {
          setErroManual(
            err instanceof Error ? err.message : "Erro ao enfileirar offline",
          );
        }
      });
      return;
    }

    startManualTransition(async () => {
      const form = new FormData();
      form.append("osId", osId);
      form.append("valor", valorManual);
      form.append("metodo", metodoManual);
      form.append("observacao", observacao);

      const res = await registrarManualAction({}, form);
      if (res.erro) {
        setErroManual(res.erro);
      } else {
        toast.success("Pagamento registrado com sucesso!");
        setEstado("PAGA");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cobrança e Pagamento</h1>
          <p className="text-sm text-muted-foreground">
            OS #{osId.slice(0, 8)} — Cliente: {clienteNome}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {estado === "PAGA" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
              <Check className="size-4" /> Pago
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-medium text-warning">
              Aguardando pagamento
            </span>
          )}

          {estado !== "PAGA" && (
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={checkingStatus}
              onClick={() => verificarEstadoServidor(false)}
              aria-label="Atualizar status do pagamento"
            >
              <RefreshCw className={`size-4 ${checkingStatus ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {estado === "PAGA" ? (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-success flex items-center gap-2">
              <Check className="size-5" /> Pagamento Confirmado
            </CardTitle>
            <CardDescription>
              Esta ordem de serviço já foi paga e concluída no sistema. Nenhuma ação de cobrança adicional é necessária.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push(`/campo/os/${osId}` as Route)}>
              Voltar para Detalhes da OS
            </Button>
          </CardFooter>
        </Card>
      ) : estado !== "CONCLUIDA" ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Cobrança Bloqueada</CardTitle>
            <CardDescription>
              Esta ordem de serviço está no estado <strong className="uppercase">{estado}</strong>. Apenas ordens no estado CONCLUÍDA podem ser pagas.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" variant="outline" onClick={() => router.push(`/campo/os/${osId}` as Route)}>
              Voltar para Detalhes da OS
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pix">Pix QR</TabsTrigger>
            <TabsTrigger value="link">Link MP</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          {/* TAB: Pix QR */}
          <TabsContent value="pix" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cobrança via Pix (Mercado Pago)</CardTitle>
                <CardDescription>
                  Gere um QR Code dinâmico para o cliente escanear na hora com o celular.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor a pagar</span>
                  <p className="text-2xl font-bold tracking-tight text-primary tabular-nums">{formatBRL(valorTotal)}</p>
                </div>

                {!isOnline ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center rounded-lg border border-warning/30 bg-warning/5 text-warning-foreground w-full">
                    <WifiOff className="size-8 text-warning" />
                    <p className="text-sm font-medium">Você está offline</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Não é possível gerar uma cobrança digital Pix sem conexão de rede.
                    </p>
                  </div>
                ) : !qrBase64 ? (
                  <Button size="lg" className="w-full max-w-sm" onClick={handleGerarPix} disabled={loadingPix}>
                    {loadingPix ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Gerando Pix...
                      </>
                    ) : (
                      "Gerar QR Code Pix"
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center space-y-4 w-full">
                    <div className="p-3 bg-white rounded-lg border border-border shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:image/png;base64,${qrBase64}`} alt="Pix QR Code" className="size-48 object-contain" />
                    </div>

                    <div className="w-full space-y-2">
                      <Label htmlFor="pix-copia-cola">Código Copia e Cola</Label>
                      <div className="flex gap-2">
                        <Input
                          id="pix-copia-cola"
                          readOnly
                          value={copiaCola ?? ""}
                          className="font-mono text-xs select-all flex-1"
                        />
                        <Button variant="outline" size="icon" className="size-10" onClick={handleCopyCopiaCola} title="Copiar código">
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {qrBase64 && (
                  <Button variant="outline" className="w-full" onClick={() => { setQrBase64(null); setCopiaCola(null); }}>
                    Gerar Novo Código
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => router.push(`/campo/os/${osId}` as Route)}>
                  Voltar para Detalhes da OS
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* TAB: Link MP */}
          <TabsContent value="link" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Link de Pagamento (Mercado Pago)</CardTitle>
                <CardDescription>
                  Gere um link do Checkout Pro e envie ao WhatsApp do cliente para pagamento remoto.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor da OS</span>
                  <p className="text-2xl font-bold tracking-tight text-primary tabular-nums">{formatBRL(valorTotal)}</p>
                </div>

                {!isOnline ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center rounded-lg border border-warning/30 bg-warning/5 text-warning-foreground w-full">
                    <WifiOff className="size-8 text-warning" />
                    <p className="text-sm font-medium">Você está offline</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Não é possível gerar links do Mercado Pago sem conexão de rede.
                    </p>
                  </div>
                ) : !urlWaMe ? (
                  <Button size="lg" className="w-full max-w-sm" onClick={handleGerarLink} disabled={loadingLink}>
                    {loadingLink ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Gerando Link...
                      </>
                    ) : (
                      "Gerar Link Checkout"
                    )}
                  </Button>
                ) : (
                  <a
                    href={urlWaMe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-md bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Send className="size-4" /> Enviar via WhatsApp
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {urlWaMe && (
                  <Button variant="outline" className="w-full" onClick={() => setUrlWaMe(null)}>
                    Gerar Novo Link
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => router.push(`/campo/os/${osId}` as Route)}>
                  Voltar para Detalhes da OS
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* TAB: Registrar Manual */}
          <TabsContent value="manual" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pagamento Recebido Manualmente</CardTitle>
                <CardDescription>
                  Registre pagamentos feitos direto a você via Dinheiro, Pix Direto ou Transferência.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isOnline && (
                  <div className="flex items-center gap-2 p-3 text-sm rounded-lg border border-warning/30 bg-warning/5 text-warning-foreground">
                    <WifiOff className="size-4 shrink-0 text-warning" />
                    <span>Modo Offline: o pagamento será salvo localmente e sincronizado ao obter sinal.</span>
                  </div>
                )}

                {erroManual && <p className="text-sm font-medium text-destructive">{erroManual}</p>}

                <div className="space-y-2">
                  <Label htmlFor="valor-manual">Valor Recebido</Label>
                  <Input
                    id="valor-manual"
                    inputMode="decimal"
                    value={valorManual}
                    onChange={(e) => setValorManual(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metodo-manual">Método de Pagamento</Label>
                  <Select value={metodoManual} onValueChange={(val) => setMetodoManual(val ?? "DINHEIRO")}>
                    <SelectTrigger id="metodo-manual" className="w-full">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DINHEIRO">Dinheiro Vivo</SelectItem>
                      <SelectItem value="PIX_DIRETO">Pix Direto (Chave da Empresa)</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência / TED / DOC</SelectItem>
                      <SelectItem value="OUTRO">Outra Forma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacao-manual">Observações / Comentários</Label>
                  <Textarea
                    id="observacao-manual"
                    placeholder="Ex: Pago direto na conta jurídica da empresa, comprovante guardado."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full h-11" disabled={pendingManual} onClick={handleRegistrarManual}>
                  {pendingManual ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Registrando...
                    </>
                  ) : !isOnline ? (
                    "Registrar Offline"
                  ) : (
                    "Confirmar e Registrar Pagamento"
                  )}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => router.push(`/campo/os/${osId}` as Route)}>
                  Voltar para Detalhes da OS
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
