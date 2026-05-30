"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Check, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/shared/signature-pad";
import { getCampoDb } from "@/features/campo/db";
import { formatBRL } from "@/lib/utils";
import { aprovarPresencialAction } from "@/app/campo/os/[id]/aprovacao/actions";

interface Resumo {
  totalMaoDeObra: string;
  totalDeslocamento: string;
  total: string;
  itens: { nome: string; quantidade: string; subtotal: string }[];
}

interface Props {
  osId: string;
  estado: string;
  isExpress: boolean;
  clienteNome: string;
  resumo: Resumo | null;
}

export function AprovacaoPresencialView({
  osId,
  estado,
  isExpress,
  clienteNome,
  resumo,
}: Props) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [lgpd, setLgpd] = useState(false);
  const [aprovou, setAprovou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (estado !== "ORCADA") {
    return (
      <p className="py-12 text-center text-base text-muted-foreground">
        Esta OS não está aguardando aprovação (estado atual: {estado}).
      </p>
    );
  }

  function confirmar() {
    setErro(null);
    if (!aprovou) return setErro("Confirme que o cliente aprovou o orçamento");
    if (!isExpress && !lgpd) {
      return setErro("Registre o aceite da LGPD pelo cliente");
    }
    if (padRef.current?.isEmpty()) {
      return setErro("A assinatura do cliente é obrigatória");
    }
    const assinaturaDataUrl = padRef.current?.toDataURL() ?? "";

    // Offline: enfileira para sincronizar quando o sinal voltar (slice 9 drena).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      startTransition(async () => {
        await getCampoDb().fila_sync.add({
          tipo: "APROVACAO_PRESENCIAL",
          payload: { osId, aprovou, lgpdAceito: lgpd, assinaturaDataUrl },
          criadoEm: new Date().toISOString(),
          tentativas: 0,
        });
        toast.success("Aprovação registrada offline — sincroniza ao voltar o sinal");
        router.push(`/campo/os/${osId}` as Route);
      });
      return;
    }

    startTransition(async () => {
      const form = new FormData();
      form.append("osId", osId);
      form.append("aprovou", aprovou ? "true" : "false");
      form.append("lgpdAceito", lgpd ? "true" : "false");
      form.append("assinaturaDataUrl", assinaturaDataUrl);
      const res = await aprovarPresencialAction({}, form);
      if (res.erro) return setErro(res.erro);
      toast.success("Orçamento aprovado pelo cliente");
      if (res.podeIniciarExecucao) {
        router.push(`/campo/os/${osId}/execucao` as Route);
      } else {
        router.push(`/campo/os/${osId}` as Route);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Aprovação no local</h1>
        <p className="text-sm text-muted-foreground">{clienteNome}</p>
      </div>

      {erro && (
        <div
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo do orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resumo ? (
            <>
              <ul className="space-y-1.5">
                {resumo.itens.map((it, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {Number(it.quantidade)}× {it.nome}
                    </span>
                    <span className="tabular-nums">{formatBRL(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Mão de obra</span>
                  <span className="tabular-nums">
                    {formatBRL(resumo.totalMaoDeObra)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Deslocamento</span>
                  <span className="tabular-nums">
                    {formatBRL(resumo.totalDeslocamento)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatBRL(resumo.total)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem orçamento montado para esta OS.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {!isExpress && (
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="lgpd"
              checked={lgpd}
              onCheckedChange={(v) => setLgpd(v === true)}
            />
            <Label
              htmlFor="lgpd"
              className="cursor-pointer text-sm leading-relaxed font-normal select-none"
            >
              O cliente aceitou os termos da LGPD para tratamento dos dados.
            </Label>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
          <Checkbox
            id="aprovou"
            checked={aprovou}
            onCheckedChange={(v) => setAprovou(v === true)}
          />
          <Label
            htmlFor="aprovou"
            className="cursor-pointer text-sm leading-relaxed font-medium select-none"
          >
            O cliente aprovou o orçamento acima.
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Assinatura do cliente</Label>
        <SignaturePad ref={padRef} />
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={confirmar}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        Confirmar aprovação
      </Button>
    </div>
  );
}
