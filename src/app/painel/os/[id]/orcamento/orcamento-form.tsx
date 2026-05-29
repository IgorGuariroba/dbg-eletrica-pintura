"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcularDeslocamento } from "@/operacao/orcamento";
import { montarOrcamentoAction } from "./actions";

interface ServicoOpcao {
  id: string;
  nome: string;
  precoBase: string;
}

interface Linha {
  servicoId: string;
  quantidade: string;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OrcamentoForm({
  osId,
  servicos,
  config,
}: {
  osId: string;
  servicos: ServicoOpcao[];
  config: { precoLitro: string; kmPorLitro: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>([
    { servicoId: "", quantidade: "1" },
  ]);
  const [km, setKm] = useState("0");
  const [override, setOverride] = useState<string | null>(null);

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

  const deslocamentoAuto = Number(
    calcularDeslocamento(Number(km) || 0, config.precoLitro, config.kmPorLitro),
  );
  const deslocamento = override != null ? Number(override) || 0 : deslocamentoAuto;
  const total = totalItens + deslocamento;

  const valido =
    linhas.some((l) => l.servicoId && Number(l.quantidade) > 0) &&
    Number(km) >= 0 &&
    total > 0;

  function atualizarLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function enviar() {
    const itens = linhas
      .filter((l) => l.servicoId && Number(l.quantidade) > 0)
      .map((l) => ({ servicoId: l.servicoId, quantidade: l.quantidade }));
    startTransition(async () => {
      try {
        await montarOrcamentoAction({
          osId,
          itens,
          km: Number(km) || 0,
          deslocamentoOverride: override,
        });
        toast.success("Orçamento enviado — OS marcada como Orçada");
        router.push("/painel/fila");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível enviar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead className="w-28">Qtd</TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Select
                    value={l.servicoId}
                    onValueChange={(v) =>
                      atualizarLinha(i, { servicoId: v ?? "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} — {brl(Number(s.precoBase))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(e) =>
                      atualizarLinha(i, { quantidade: e.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">{brl(subtotais[i])}</TableCell>
                <TableCell>
                  {linhas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setLinhas((ls) => ls.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={servicos.length === 0}
        onClick={() =>
          setLinhas((ls) => [...ls, { servicoId: "", quantidade: "1" }])
        }
      >
        Adicionar serviço
      </Button>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <div>
          <Label htmlFor="km">Deslocamento (km ida + volta)</Label>
          <Input
            id="km"
            type="text"
            inputMode="decimal"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="deslocamento">Valor deslocamento</Label>
          <Input
            id="deslocamento"
            type="text"
            inputMode="decimal"
            value={override ?? deslocamentoAuto.toFixed(2)}
            disabled={override == null}
            onChange={(e) => setOverride(e.target.value)}
          />
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground underline"
            onClick={() =>
              setOverride((o) =>
                o == null ? deslocamentoAuto.toFixed(2) : null,
              )
            }
          >
            {override == null ? "Editar valor" : "Voltar ao cálculo automático"}
          </button>
        </div>
      </div>

      <div className="max-w-md space-y-1 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Itens</span>
          <span>{brl(totalItens)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Deslocamento</span>
          <span>{brl(deslocamento)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{brl(total)}</span>
        </div>
      </div>

      <Button type="button" disabled={!valido || pending} onClick={enviar}>
        {pending ? "Enviando…" : "Enviar orçamento"}
      </Button>
    </div>
  );
}
