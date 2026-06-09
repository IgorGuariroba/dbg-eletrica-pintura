"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL } from "@/lib/utils";
import type { DepoimentoCandidato } from "@/marketing/landing/depoimentos-query";
import {
  adicionarFotoAction,
  assinarUploadFotoLandingAction,
  definirDepoimentosAction,
  removerFotoAction,
  salvarOverrideAction,
} from "./actions";

const SEM_UPSELL = "__nenhum__";

interface Props {
  servicoId: string;
  slug: string;
  precoBase: string;
  nomeServico: string;
  inicial: {
    titulo: string;
    descricao: string;
    precoPromo: string;
    upsellServicoId: string;
    depoimentoIds: string[];
  };
  fotos: { id: string; url: string }[];
  candidatosDepoimento: DepoimentoCandidato[];
  outrosServicos: { id: string; nome: string }[];
}

export function LandingOverrideForm({
  servicoId,
  slug,
  precoBase,
  nomeServico,
  inicial,
  fotos,
  candidatosDepoimento,
  outrosServicos,
}: Props) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [precoPromo, setPrecoPromo] = useState(inicial.precoPromo);
  const [upsell, setUpsell] = useState(inicial.upsellServicoId || SEM_UPSELL);
  const [selecionados, setSelecionados] = useState<string[]>(
    inicial.depoimentoIds,
  );
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function salvar() {
    startSalvar(async () => {
      const r = await salvarOverrideAction({
        servicoId,
        slug,
        precoBase,
        titulo,
        descricao,
        precoPromo,
        upsellServicoId: upsell === SEM_UPSELL ? null : upsell,
      });
      if (r.erro) {
        toast.error(r.erro);
        return;
      }
      const rd = await definirDepoimentosAction({
        servicoId,
        slug,
        avaliacaoIds: selecionados,
      });
      if (rd.erro) {
        toast.error(rd.erro);
        return;
      }
      toast.success("Landing atualizada e republicada.");
    });
  }

  async function enviarFoto(file: File) {
    setEnviandoFoto(true);
    try {
      const { uploadUrl, key } = await assinarUploadFotoLandingAction({
        filename: file.name,
        contentType: file.type,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload falhou (${res.status})`);
      const r = await adicionarFotoAction({ servicoId, slug, chave: key });
      if (r.erro) throw new Error(r.erro);
      toast.success("Foto adicionada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setEnviandoFoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removerFoto(fotoId: string) {
    startSalvar(async () => {
      const r = await removerFotoAction({ fotoId, slug });
      if (r.erro) toast.error(r.erro);
      else toast.success("Foto removida.");
    });
  }

  function toggleDepoimento(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título alternativo</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={nomeServico}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vazio usa o nome do serviço.
            </p>
          </div>
          <div>
            <Label htmlFor="descricao">Descrição alternativa</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Vazio usa a descrição padrão da categoria."
            />
          </div>
        </CardContent>
      </Card>

      {/* Preço e upsell */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preço e indicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="precoPromo">
              Preço promocional (base {formatBRL(precoBase)})
            </Label>
            <Input
              id="precoPromo"
              inputMode="decimal"
              value={precoPromo}
              onChange={(e) => setPrecoPromo(e.target.value)}
              placeholder="Ex.: 199.90"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Exibido na landing como preço base riscado + promo. Não altera o
              Catálogo.
            </p>
          </div>
          <div>
            <Label htmlFor="upsell">Serviço sugerido (upsell)</Label>
            <Select
              value={upsell}
              onValueChange={(v) => setUpsell(v ?? SEM_UPSELL)}
            >
              <SelectTrigger id="upsell" className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_UPSELL}>Nenhum</SelectItem>
                {outrosServicos.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fotos adicionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {fotos.map((f) => (
                <div
                  key={f.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={f.url}
                    alt="Foto da landing"
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    className="absolute right-1 top-1"
                    onClick={() => removerFoto(f.id)}
                    aria-label="Remover foto"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma foto adicional.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void enviarFoto(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={enviandoFoto}
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            {enviandoFoto ? "Enviando…" : "Adicionar foto"}
          </Button>
        </CardContent>
      </Card>

      {/* Depoimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Depoimentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidatosDepoimento.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma avaliação qualificada (4★ ou mais com comentário)
              disponível.
            </p>
          ) : (
            candidatosDepoimento.map((c) => {
              const checked = selecionados.includes(c.avaliacaoId);
              return (
                <label
                  key={c.avaliacaoId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleDepoimento(c.avaliacaoId)}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: c.nota }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-3.5 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-foreground">{c.texto}</p>
                    <p className="text-xs text-muted-foreground">{c.nome}</p>
                  </div>
                </label>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar e publicar"}
        </Button>
      </div>
    </div>
  );
}
