"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type ActionState,
  atualizarItemAction,
  criarItemAction,
  removerItemAction,
} from "@/app/admin/catalogo/checklist/[categoria]/actions";
import type { ChecklistItem } from "@/catalogo/checklist-repo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/app/admin/_components/empty-state";

type Modo =
  | { tipo: "novo" }
  | { tipo: "editar"; item: ChecklistItem };

function ItemDialog({
  categoria,
  modo,
  proximaOrdem,
  open,
  onOpenChange,
}: {
  categoria: string;
  modo: Modo;
  proximaOrdem: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const item = modo.tipo === "editar" ? modo.item : null;
  const action =
    modo.tipo === "editar"
      ? atualizarItemAction.bind(null, item!.id, categoria)
      : criarItemAction.bind(null, categoria);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(item ? "Item atualizado" : "Item adicionado");
      onOpenChange(false);
    } else if (state.erro) {
      toast.error(state.erro);
    }
  }, [state, item, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
          <DialogDescription>
            Item de verificação do checklist preventivo desta categoria.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              name="descricao"
              defaultValue={item?.descricao ?? ""}
              placeholder="Ex: Verificar disjuntores"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ordem">Ordem</Label>
            <Input
              id="ordem"
              name="ordem"
              type="number"
              min={0}
              defaultValue={item?.ordem ?? proximaOrdem}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="exigeFoto">Exige foto</Label>
              <p className="text-sm text-muted-foreground">
                O técnico precisa anexar foto para concluir este item.
              </p>
            </div>
            <Switch
              id="exigeFoto"
              name="exigeFoto"
              defaultChecked={item?.exigeFoto ?? false}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoverItem({
  id,
  categoria,
  descricao,
}: {
  id: string;
  categoria: string;
  descricao: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover ${descricao}`}
          />
        }
      >
        <Trash2 className="size-4 text-muted-foreground" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover item?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{descricao}&quot; será removido do checklist. Resultados já
            registrados em OS preservam o histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await removerItemAction(id, categoria);
                toast.success("Item removido");
              })
            }
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ChecklistEditor({
  categoria,
  itens,
}: {
  categoria: string;
  itens: ChecklistItem[];
}) {
  const [modo, setModo] = useState<Modo>({ tipo: "novo" });
  const [open, setOpen] = useState(false);
  // Remonta o ItemDialog a cada abertura para resetar o estado do formulário.
  const [instancia, setInstancia] = useState(0);
  const proximaOrdem = itens.length
    ? Math.max(...itens.map((i) => i.ordem)) + 1
    : 0;

  function abrirNovo() {
    setInstancia((n) => n + 1);
    setModo({ tipo: "novo" });
    setOpen(true);
  }
  function abrirEditar(item: ChecklistItem) {
    setInstancia((n) => n + 1);
    setModo({ tipo: "editar", item });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={abrirNovo}>
          <Plus className="size-4" />
          Novo item
        </Button>
      </div>

      <ItemDialog
        key={instancia}
        categoria={categoria}
        modo={modo}
        proximaOrdem={proximaOrdem}
        open={open}
        onOpenChange={setOpen}
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={Camera}
          titulo="Checklist vazio"
          descricao="Adicione itens de verificação para a equipe seguir na OS preventiva."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-right">Ordem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {i.ordem}
                  </TableCell>
                  <TableCell className="font-medium">{i.descricao}</TableCell>
                  <TableCell>
                    {i.exigeFoto ? (
                      <Badge variant="secondary">
                        <Camera className="size-3" />
                        Obrigatória
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${i.descricao}`}
                      onClick={() => abrirEditar(i)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <RemoverItem
                      id={i.id}
                      categoria={categoria}
                      descricao={i.descricao}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
