"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Servico } from "@/catalogo/servico-repo";
import { assinarUploadFotoAction, type ActionState } from "./actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

// Base UI Select.Value mostra o valor cru; estes mapas traduzem para o rótulo.
const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};
const LABEL_UNIDADE: Record<string, string> = {
  PONTO: "Ponto",
  M2: "m²",
  HORA: "Hora",
};

export function ServicoForm({
  action,
  servico,
}: {
  action: Action;
  servico?: Servico;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  const [fotoUrl, setFotoUrl] = useState(servico?.fotoUrl ?? "");
  const [ativo, setAtivo] = useState(servico?.ativo ?? true);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  async function enviarFoto(file: File) {
    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      const { uploadUrl, publicUrl } = await assinarUploadFotoAction({
        filename: file.name,
        contentType: file.type,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload falhou (${res.status})`);
      setFotoUrl(publicUrl);
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={servico?.nome} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="categoria">Categoria</Label>
          <Select name="categoria" defaultValue={servico?.categoria ?? "ELETRICA"}>
            <SelectTrigger id="categoria">
              <SelectValue>
                {(v: string) => LABEL_CATEGORIA[v] ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ELETRICA">Elétrica</SelectItem>
              <SelectItem value="PINTURA">Pintura</SelectItem>
              <SelectItem value="DRYWALL">Drywall</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="unidade">Unidade</Label>
          <Select name="unidade" defaultValue={servico?.unidade ?? "PONTO"}>
            <SelectTrigger id="unidade">
              <SelectValue>
                {(v: string) => LABEL_UNIDADE[v] ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PONTO">Ponto</SelectItem>
              <SelectItem value="M2">m²</SelectItem>
              <SelectItem value="HORA">Hora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="precoBase">Preço base (R$)</Label>
          <Input
            id="precoBase"
            name="precoBase"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={servico?.precoBase}
          />
        </div>
        <div>
          <Label htmlFor="prazoGarantiaMeses">Garantia (meses)</Label>
          <Input
            id="prazoGarantiaMeses"
            name="prazoGarantiaMeses"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={servico?.prazoGarantiaMeses ?? 0}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="foto">Foto (opcional)</Label>
        <Input
          id="foto"
          type="file"
          accept="image/*"
          disabled={enviandoFoto}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviarFoto(f);
          }}
        />
        <input type="hidden" name="fotoUrl" value={fotoUrl} />
        {enviandoFoto && (
          <p className="text-xs text-muted-foreground mt-1">Enviando…</p>
        )}
        {erroFoto && <p className="text-xs text-destructive mt-1">{erroFoto}</p>}
        {fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoUrl}
            alt="Pré-visualização"
            className="mt-2 h-24 w-24 rounded object-cover border border-border"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
        <Label htmlFor="ativo">Ativo</Label>
        <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />
      </div>

      {state.erro && (
        <p className="text-sm text-destructive" role="alert">
          {state.erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || enviandoFoto}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Link href="/admin/catalogo" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
