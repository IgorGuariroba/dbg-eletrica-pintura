"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CircleAlert, Loader2, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { comprimirFoto } from "@/features/campo/comprimir-foto";
import { getCampoDb } from "@/features/campo/db";
import {
  ChecklistIncompletoError,
  finalizarChecklist,
  lerRespostas,
  salvarFotoItem,
  salvarRespostaItem,
  type ItemTemplate,
} from "@/features/campo/checklist-repo";
import { sincronizarFilaOffline } from "@/features/campo/sync-runner";
import {
  avaliarConclusao,
  type RespostaChecklist,
  type StatusChecklist,
} from "@/operacao/checklist-conclusao";

interface RespostaUi {
  status: StatusChecklist;
  observacao?: string;
  temFoto: boolean;
}

const STATUS_META: Record<
  StatusChecklist,
  { label: string; icon: typeof Check }
> = {
  OK: { label: "OK", icon: Check },
  PROBLEMA: { label: "Problema", icon: CircleAlert },
  NA: { label: "N/A", icon: MinusCircle },
};

export function ChecklistView({
  osId,
  itens,
}: {
  osId: string;
  itens: ItemTemplate[];
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [respostas, setRespostas] = useState<Record<string, RespostaUi>>({});
  const [previews, setPreviews] = useState<Record<string, Blob>>({});
  const [finalizando, setFinalizando] = useState(false);

  async function recarregar() {
    const db = getCampoDb();
    const lidas = await lerRespostas(db, osId);
    setRespostas(lidas);
    const linhas = await db.checklist_local.where("osId").equals(osId).toArray();
    const blobs: Record<string, Blob> = {};
    for (const l of linhas) if (l.fotoBlob) blobs[l.itemId] = l.fotoBlob;
    setPreviews(blobs);
  }

  useEffect(() => {
    async function carregar() {
      await recarregar();
      setCarregando(false);
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osId]);

  async function marcar(itemId: string, status: StatusChecklist) {
    await salvarRespostaItem(getCampoDb(), osId, itemId, {
      status,
      observacao: respostas[itemId]?.observacao,
    });
    await recarregar();
  }

  async function salvarObservacao(itemId: string, texto: string) {
    const atual = respostas[itemId];
    if (!atual) return;
    await salvarRespostaItem(getCampoDb(), osId, itemId, {
      status: atual.status,
      observacao: texto.trim() || undefined,
    });
    await recarregar();
  }

  async function capturarFoto(itemId: string, arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const { blob } = await comprimirFoto(arquivo);
      await salvarFotoItem(getCampoDb(), osId, itemId, blob);
      await recarregar();
      toast.success("Foto anexada");
    } catch {
      toast.error("Não foi possível processar a foto");
    }
  }

  async function finalizar() {
    setFinalizando(true);
    try {
      await finalizarChecklist(getCampoDb(), osId, itens);
      toast.success("Checklist concluído");
      void sincronizarFilaOffline().catch(() => {});
      router.push(`/campo/os/${osId}`);
    } catch (e) {
      if (e instanceof ChecklistIncompletoError) {
        toast.error(`Faltam ${e.faltam.length} item(ns) para concluir`);
      } else {
        toast.error("Não foi possível concluir o checklist");
      }
    } finally {
      setFinalizando(false);
    }
  }

  const conclusao = useMemo(() => {
    const respostasRegra: Record<string, RespostaChecklist> = {};
    for (const [itemId, r] of Object.entries(respostas)) {
      respostasRegra[itemId] = { status: r.status, temFoto: r.temFoto };
    }
    return avaliarConclusao(
      itens.map((i) => ({ id: i.id, exigeFoto: i.exigeFoto })),
      respostasRegra,
    );
  }, [respostas, itens]);

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const preenchidos = itens.length - conclusao.faltam.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Checklist preventivo</h1>
        <p className="text-sm text-muted-foreground">
          {preenchidos} de {itens.length} item{itens.length === 1 ? "" : "s"}{" "}
          concluído{preenchidos === 1 ? "" : "s"}
        </p>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum item de checklist cadastrado para esta categoria.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {itens.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              resposta={respostas[item.id]}
              previewBlob={previews[item.id]}
              onMarcar={(s) => marcar(item.id, s)}
              onObservacao={(t) => salvarObservacao(item.id, t)}
              onFoto={(f) => capturarFoto(item.id, f)}
            />
          ))}
        </ul>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!conclusao.pode || finalizando || itens.length === 0}
        onClick={finalizar}
      >
        {finalizando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Concluir checklist
      </Button>
    </div>
  );
}

function ItemCard({
  item,
  resposta,
  previewBlob,
  onMarcar,
  onObservacao,
  onFoto,
}: {
  item: ItemTemplate;
  resposta: RespostaUi | undefined;
  previewBlob: Blob | undefined;
  onMarcar: (s: StatusChecklist) => void;
  onObservacao: (texto: string) => void;
  onFoto: (arquivo: File | undefined) => void;
}) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const status = resposta?.status;
  const ehProblema = status === "PROBLEMA";
  const fotoObrigatoria =
    status !== "NA" && (item.exigeFoto || ehProblema);
  const fotoPendente = fotoObrigatoria && !resposta?.temFoto;

  return (
    <li>
      <Card className={cn(ehProblema && "border-destructive")}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">
              {item.descricao}
            </CardTitle>
            {item.exigeFoto && (
              <Badge variant="secondary" className="shrink-0">
                <Camera className="size-3" aria-hidden />
                Foto
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(STATUS_META) as StatusChecklist[]).map((s) => {
              const Icon = STATUS_META[s].icon;
              const ativo = status === s;
              const variante =
                ativo && s === "PROBLEMA"
                  ? "destructive"
                  : ativo
                    ? "default"
                    : "outline";
              return (
                <Button
                  key={s}
                  variant={variante}
                  aria-pressed={ativo}
                  className="h-11"
                  onClick={() => onMarcar(s)}
                >
                  <Icon className="size-4" aria-hidden />
                  {STATUS_META[s].label}
                </Button>
              );
            })}
          </div>

          {status && (
            <Textarea
              defaultValue={resposta?.observacao ?? ""}
              onBlur={(e) => onObservacao(e.target.value)}
              placeholder="Observação (opcional)"
              className="min-h-16"
            />
          )}

          {fotoObrigatoria && (
            <div className="space-y-2">
              {previewBlob ? (
                <FotoPreview blob={previewBlob} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Foto obrigatória para este item.
                </p>
              )}
              <Input
                ref={inputFoto}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  onFoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                variant={fotoPendente ? "default" : "outline"}
                className="w-full"
                onClick={() => inputFoto.current?.click()}
              >
                <Camera className="size-4" aria-hidden />
                {previewBlob ? "Trocar foto" : "Tirar foto"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function FotoPreview({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Foto do item" className="size-full object-cover" />
    </div>
  );
}
