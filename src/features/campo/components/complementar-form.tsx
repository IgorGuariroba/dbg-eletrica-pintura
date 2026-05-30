"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Check, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcularDeslocamento } from "@/operacao/deslocamento-calculo";
import { formatBRL } from "@/lib/utils";
import { montarLinkWhatsApp, mensagemAprovacaoComplementar } from "@/lib/whatsapp";
import { criarComplementarAction } from "@/app/campo/os/[id]/complementar/nova/actions";

interface ServicoOpcao {
  id: string;
  nome: string;
  precoBase: string;
}
interface Linha {
  servicoId: string;
  quantidade: string;
}

interface Props {
  osPaiId: string;
  categoria: string;
  servicos: ServicoOpcao[];
  config: { precoLitro: string; kmPorLitro: string };
  clienteNome: string;
  whatsapp: string;
  solToken: string;
  tecnicoNome: string;
}

export function ComplementarForm({
  osPaiId,
  categoria,
  servicos,
  config,
  clienteNome,
  whatsapp,
  solToken,
  tecnicoNome,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>([{ servicoId: "", quantidade: "1" }]);
  const [km, setKm] = useState("0");
  const [erro, setErro] = useState<string | null>(null);
  const [complementarId, setComplementarId] = useState<string | null>(null);

  const precoPorId = useMemo(
    () => new Map(servicos.map((s) => [s.id, Number(s.precoBase)])),
    [servicos],
  );

  const subtotais = linhas.map((l) => {
    const preco = precoPorId.get(l.servicoId) ?? 0;
    const qtd = Number(l.quantidade);
    return l.servicoId && qtd > 0 ? preco * qtd : 0;
  });
  const totalItens = subtotais.reduce((a, b) => a + b, 0);
  const deslocamento = Number(
    calcularDeslocamento(Number(km) || 0, config.precoLitro, config.kmPorLitro),
  );
  const total = totalItens + deslocamento;
  const valido =
    linhas.some((l) => l.servicoId && Number(l.quantidade) > 0) &&
    Number(km) >= 0 &&
    total > 0;

  function atualizar(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const form = new FormData();
      form.append("osPaiId", osPaiId);
      form.append("km", km);
      for (const l of linhas) {
        if (l.servicoId && Number(l.quantidade) > 0) {
          form.append("servicoId", l.servicoId);
          form.append("quantidade", l.quantidade);
        }
      }
      const res = await criarComplementarAction({}, form);
      if (res.erro) return setErro(res.erro);
      setComplementarId(res.complementarId ?? null);
    });
  }

  // Etapa 2: complementar criada — escolher aprovação presencial ou remota.
  if (complementarId) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const linkWhats = montarLinkWhatsApp({
      whatsapp,
      texto: mensagemAprovacaoComplementar({
        clienteNome: clienteNome.split(" ")[0],
        tecnicoNome: tecnicoNome.split(" ")[0],
        link: `${base}/s/${solToken}`,
      }),
    });
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Complementar criada</h1>
          <p className="text-sm text-muted-foreground">
            Como o cliente vai aprovar este orçamento adicional?
          </p>
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() =>
            router.push(`/campo/os/${complementarId}/aprovacao` as Route)
          }
        >
          <Check className="size-4" aria-hidden />
          Cliente vai assinar agora
        </Button>
        <a
          href={linkWhats}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          <MessageCircle className="size-4" aria-hidden />
          Enviar pro cliente aprovar depois
        </a>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => router.push(`/campo/os/${osPaiId}` as Route)}
        >
          Voltar à OS
        </Button>
      </div>
    );
  }

  // Etapa 1: montagem do orçamento complementar.
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Orçamento complementar</h1>
        <p className="text-sm text-muted-foreground">
          Serviços de {categoria} encontrados durante a execução
        </p>
      </div>

      {erro && (
        <div
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {erro}
        </div>
      )}

      <div className="space-y-3">
        {linhas.map((l, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-2">
                <Label className="text-xs">Serviço</Label>
                <Select
                  value={l.servicoId}
                  onValueChange={(v) => atualizar(i, { servicoId: v ?? "" })}
                >
                  <SelectTrigger className="w-full">
                    {/* Base UI mostra o valor cru por padrão — exibe o nome. */}
                    <SelectValue placeholder="Selecione">
                      {() =>
                        servicos.find((s) => s.id === l.servicoId)?.nome ??
                        "Selecione"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} — {formatBRL(Number(s.precoBase))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`qtd-${i}`} className="text-xs">
                    Quantidade
                  </Label>
                  <Input
                    id={`qtd-${i}`}
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(e) => atualizar(i, { quantidade: e.target.value })}
                  />
                </div>
                <div className="pb-1 text-right">
                  <span className="text-xs text-muted-foreground">Subtotal</span>
                  <p className="font-semibold tabular-nums">
                    {formatBRL(subtotais[i])}
                  </p>
                </div>
                {linhas.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover serviço"
                    onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={servicos.length === 0}
        onClick={() => setLinhas((ls) => [...ls, { servicoId: "", quantidade: "1" }])}
      >
        <Plus className="size-4" aria-hidden />
        Adicionar serviço
      </Button>

      <div className="space-y-2">
        <Label htmlFor="km">Deslocamento (km ida + volta)</Label>
        <Input
          id="km"
          inputMode="decimal"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </div>

      <div className="space-y-1 border-t pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Itens</span>
          <span className="tabular-nums">{formatBRL(totalItens)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Deslocamento</span>
          <span className="tabular-nums">{formatBRL(deslocamento)}</span>
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatBRL(total)}</span>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!valido || pending}
        onClick={enviar}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        Criar complementar
      </Button>
    </div>
  );
}
