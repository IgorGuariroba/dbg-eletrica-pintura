"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Camera, Loader2, Plus, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { comprimirFoto } from "@/features/campo/comprimir-foto";
import { getCampoDb, type MaterialConsumido } from "@/features/campo/db";
import { obterLocalizacao } from "@/features/campo/geo";
import {
  podeConcluir,
  podeIniciarExecucao,
} from "@/features/campo/execucao-regras";
import {
  adicionarMaterial,
  contarPendentesSync,
  listarFotos,
  listarMateriais,
  lerNota,
  salvarFotoPendente,
  salvarNota,
  togglePortfolio,
  type FotoLocal,
} from "@/features/campo/execucao-repo";

type Tipo = "ANTES" | "DEPOIS";

const ESTADO_LABEL: Record<string, string> = {
  APROVADA: "Aprovada",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
};

export function ExecucaoView({ osId }: { osId: string }) {
  const [carregando, setCarregando] = useState(true);
  const [estado, setEstado] = useState<string>("");
  const [antes, setAntes] = useState<FotoLocal[]>([]);
  const [depois, setDepois] = useState<FotoLocal[]>([]);
  const [nota, setNota] = useState("");
  const [materiais, setMateriais] = useState<MaterialConsumido[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [capturando, setCapturando] = useState<Tipo | null>(null);
  const [transitando, setTransitando] = useState(false);

  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const inputAntes = useRef<HTMLInputElement>(null);
  const inputDepois = useRef<HTMLInputElement>(null);

  async function recarregar() {
    const db = getCampoDb();
    const osLocal = await db.os_local_cache.get(osId);
    setEstado(osLocal?.estado ?? "");
    setAntes(await listarFotos(db, osId, "ANTES"));
    setDepois(await listarFotos(db, osId, "DEPOIS"));
    setNota(await lerNota(db, osId));
    setMateriais(await listarMateriais(db, osId));
    setPendentes(await contarPendentesSync(db));
  }

  useEffect(() => {
    async function carregar() {
      await recarregar();
      setCarregando(false);
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osId]);

  async function aoCapturar(tipo: Tipo, arquivo: File | undefined) {
    if (!arquivo) return;
    setCapturando(tipo);
    try {
      const { blob, bytes } = await comprimirFoto(arquivo);
      const geo = await obterLocalizacao();
      await salvarFotoPendente(getCampoDb(), {
        osId,
        tipo,
        blob,
        lat: geo?.lat,
        lon: geo?.lon,
      });
      await recarregar();
      toast.success(
        `Foto ${tipo === "ANTES" ? "antes" : "depois"} salva (${(
          bytes / 1024
        ).toFixed(0)} KB)`,
      );
    } catch {
      toast.error("Não foi possível processar a foto");
    } finally {
      setCapturando(null);
    }
  }

  async function aoTogglePortfolio(fotoId: number) {
    await togglePortfolio(getCampoDb(), fotoId);
    await recarregar();
  }

  async function transitar(alvo: "EM_EXECUCAO" | "CONCLUIDA") {
    setTransitando(true);
    try {
      const res = await fetch(`/api/campo/os/${osId}/transicao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alvo }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { estado: novo } = (await res.json()) as { estado: string };
      await getCampoDb().os_local_cache.update(osId, { estado: novo });
      setEstado(novo);
      toast.success(
        alvo === "EM_EXECUCAO" ? "Execução iniciada" : "OS concluída",
      );
    } catch {
      toast.error("Sem conexão — tente novamente quando voltar o sinal");
    } finally {
      setTransitando(false);
    }
  }

  async function aoAdicionarMaterial() {
    const qtd = Number(quantidade.replace(",", "."));
    if (!item.trim() || !Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe item e quantidade válidos");
      return;
    }
    await adicionarMaterial(getCampoDb(), osId, {
      item: item.trim(),
      quantidade: qtd,
      observacao: observacao.trim() || undefined,
    });
    setItem("");
    setQuantidade("");
    setObservacao("");
    await recarregar();
  }

  async function aoSalvarNota() {
    await salvarNota(getCampoDb(), osId, nota);
    setPendentes(await contarPendentesSync(getCampoDb()));
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Execução</h1>
          <p className="text-sm text-muted-foreground">
            Estado: {ESTADO_LABEL[estado] ?? (estado || "—")}
          </p>
        </div>
        {pendentes > 0 && (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="size-3" aria-hidden />
            {pendentes} pendente{pendentes > 1 ? "s" : ""} sync
          </Badge>
        )}
      </div>

      <FotoCard
        titulo="Fotos antes"
        ajuda="Pelo menos 1 foto para iniciar a execução"
        fotos={antes}
        capturando={capturando === "ANTES"}
        inputRef={inputAntes}
        onSelecionar={(f) => aoCapturar("ANTES", f)}
        onTogglePortfolio={aoTogglePortfolio}
      />

      <Button
        className="w-full"
        size="lg"
        disabled={!podeIniciarExecucao(estado, antes.length) || transitando}
        onClick={() => transitar("EM_EXECUCAO")}
      >
        {transitando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Iniciar execução
      </Button>

      <FotoCard
        titulo="Fotos depois"
        ajuda="Pelo menos 1 foto para concluir a OS"
        fotos={depois}
        capturando={capturando === "DEPOIS"}
        inputRef={inputDepois}
        onSelecionar={(f) => aoCapturar("DEPOIS", f)}
        onTogglePortfolio={aoTogglePortfolio}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas de serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={aoSalvarNota}
            placeholder="Descreva o que foi feito, observações ao cliente, etc."
            className="min-h-24"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materiais consumidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {materiais.length > 0 && (
            <ul className="space-y-2">
              {materiais.map((m) => (
                <li
                  key={m.id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="font-medium">{m.item}</span>
                  <span className="text-muted-foreground">
                    {m.quantidade}
                    {m.observacao ? ` · ${m.observacao}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="material-item">Item</Label>
                <Input
                  id="material-item"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="Ex: Fio 2.5mm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="material-qtd">Qtd</Label>
                <Input
                  id="material-qtd"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="material-obs">Observação</Label>
              <Input
                id="material-obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={aoAdicionarMaterial}
            >
              Adicionar material
            </Button>
          </div>
        </CardContent>
      </Card>

      {estado === "EM_EXECUCAO" && (
        <Link
          href={`/campo/os/${osId}/complementar/nova` as Route}
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          <Plus className="size-4" aria-hidden />
          Orçamento complementar
        </Link>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!podeConcluir(estado, depois.length) || transitando}
        onClick={() => transitar("CONCLUIDA")}
      >
        {transitando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Concluir
      </Button>
    </div>
  );
}

function FotoCard({
  titulo,
  ajuda,
  fotos,
  capturando,
  inputRef,
  onSelecionar,
  onTogglePortfolio,
}: {
  titulo: string;
  ajuda: string;
  fotos: FotoLocal[];
  capturando: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelecionar: (arquivo: File | undefined) => void;
  onTogglePortfolio: (fotoId: number) => void;
}) {
  const total = fotos.length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <Badge variant={total > 0 ? "default" : "secondary"}>
            {total} foto{total === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{ajuda}</p>
        {total > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {fotos.map((f) => (
              <FotoThumb
                key={f.id}
                foto={f}
                onToggle={() => onTogglePortfolio(f.id)}
              />
            ))}
          </ul>
        )}
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onSelecionar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={capturando}
          onClick={() => inputRef.current?.click()}
        >
          {capturando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
          Tirar foto
        </Button>
      </CardContent>
    </Card>
  );
}

function FotoThumb({
  foto,
  onToggle,
}: {
  foto: FotoLocal;
  onToggle: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(foto.blob), [foto.blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <li className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto da execução"
        className="size-full object-cover"
      />
      <Button
        type="button"
        size="icon"
        variant={foto.portfolio ? "default" : "secondary"}
        aria-pressed={foto.portfolio}
        aria-label={
          foto.portfolio
            ? "Remover do portfólio"
            : "Marcar como boa pra portfólio"
        }
        onClick={onToggle}
        className="absolute bottom-1 right-1 size-8 shadow-sm"
      >
        <Star
          className={`size-4 ${foto.portfolio ? "fill-current" : ""}`}
          aria-hidden
        />
      </Button>
    </li>
  );
}
