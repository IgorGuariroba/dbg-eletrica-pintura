"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  Categoria,
  DiaSemana,
  DisponibilidadeSemanal,
  Membro,
  Modulo,
} from "@/equipe/membro-repo";
import {
  ActionState,
  assinarUploadFotoMembroAction,
} from "./actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const MODULOS: Modulo[] = [
  "OPERACAO",
  "FINANCEIRO",
  "MARKETING",
  "EQUIPE",
  "GARANTIAS",
  "CATALOGO",
];

const ESPECIALIDADES: Categoria[] = ["ELETRICA", "PINTURA", "DRYWALL"];

const DIAS: { dia: DiaSemana; label: string }[] = [
  { dia: "dom", label: "Domingo" },
  { dia: "seg", label: "Segunda" },
  { dia: "ter", label: "Terça" },
  { dia: "qua", label: "Quarta" },
  { dia: "qui", label: "Quinta" },
  { dia: "sex", label: "Sexta" },
  { dia: "sab", label: "Sábado" },
];

interface DispEstado {
  ativo: boolean;
  inicio: string;
  fim: string;
}

function initDisp(d: DisponibilidadeSemanal | null): Record<DiaSemana, DispEstado> {
  const out = {} as Record<DiaSemana, DispEstado>;
  for (const { dia } of DIAS) {
    const j = d?.[dia];
    out[dia] = {
      ativo: Boolean(j),
      inicio: j?.inicio ?? "08:00",
      fim: j?.fim ?? "18:00",
    };
  }
  return out;
}

export function MembroForm({
  action,
  membro,
  disabled = false,
}: {
  action: Action;
  membro?: Membro;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  const [isTecnico, setIsTecnico] = useState(membro?.isTecnico ?? false);
  const [modulos, setModulos] = useState<Set<Modulo>>(
    new Set(membro?.modulos ?? []),
  );
  const [especialidades, setEspecialidades] = useState<Set<Categoria>>(
    new Set(membro?.especialidades ?? []),
  );
  const [fotoUrl, setFotoUrl] = useState(membro?.fotoUrl ?? "");
  const [ativo, setAtivo] = useState(membro?.ativo ?? true);
  const [disp, setDisp] = useState(initDisp(membro?.disponibilidade ?? null));
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  function toggle<T extends string>(
    set: Set<T>,
    setSet: (s: Set<T>) => void,
    v: T,
  ) {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    setSet(n);
  }

  async function enviarFoto(file: File) {
    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      const { uploadUrl, publicUrl } = await assinarUploadFotoMembroAction({
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
      setErroFoto(e instanceof Error ? e.message : "falha no upload");
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required defaultValue={membro?.nome} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={membro?.email}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <Input id="bio" name="bio" defaultValue={membro?.bio ?? ""} />
        </div>

        <div>
          <Label>Módulos administrativos</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {MODULOS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={modulos.has(m)}
                  onCheckedChange={() => toggle(modulos, setModulos, m)}
                />
                {m}
              </label>
            ))}
          </div>
          {[...modulos].map((m) => (
            <input key={m} type="hidden" name="modulos" value={m} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Switch id="isTecnico" checked={isTecnico} onCheckedChange={setIsTecnico} />
          <Label htmlFor="isTecnico">Também é técnico de campo</Label>
          <input type="hidden" name="isTecnico" value={isTecnico ? "true" : "false"} />
        </div>

        {isTecnico && (
          <>
            <div>
              <Label>Especialidades</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {ESPECIALIDADES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={especialidades.has(c)}
                      onCheckedChange={() =>
                        toggle(especialidades, setEspecialidades, c)
                      }
                    />
                    {c}
                  </label>
                ))}
              </div>
              {[...especialidades].map((c) => (
                <input key={c} type="hidden" name="especialidades" value={c} />
              ))}
            </div>

            <div>
              <Label>Disponibilidade semanal</Label>
              <div className="mt-2 space-y-2">
                {DIAS.map(({ dia, label }) => (
                  <div key={dia} className="flex items-center gap-3">
                    <label className="flex w-32 items-center gap-2 text-sm">
                      <Checkbox
                        checked={disp[dia].ativo}
                        onCheckedChange={() =>
                          setDisp({
                            ...disp,
                            [dia]: { ...disp[dia], ativo: !disp[dia].ativo },
                          })
                        }
                      />
                      {label}
                    </label>
                    <Input
                      type="time"
                      value={disp[dia].inicio}
                      onChange={(e) =>
                        setDisp({
                          ...disp,
                          [dia]: { ...disp[dia], inicio: e.target.value },
                        })
                      }
                      disabled={!disp[dia].ativo}
                      className="w-32"
                    />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input
                      type="time"
                      value={disp[dia].fim}
                      onChange={(e) =>
                        setDisp({
                          ...disp,
                          [dia]: { ...disp[dia], fim: e.target.value },
                        })
                      }
                      disabled={!disp[dia].ativo}
                      className="w-32"
                    />
                    <input
                      type="hidden"
                      name={`disp_${dia}_ativo`}
                      value={disp[dia].ativo ? "on" : ""}
                    />
                    <input
                      type="hidden"
                      name={`disp_${dia}_inicio`}
                      value={disp[dia].inicio}
                    />
                    <input
                      type="hidden"
                      name={`disp_${dia}_fim`}
                      value={disp[dia].fim}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <Label htmlFor="foto">Foto (opcional)</Label>
          <Input
            id="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
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
          <Link
            href="/admin/equipe"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancelar
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
