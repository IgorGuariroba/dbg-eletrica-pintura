"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActions({
  editarHref,
  ativo,
  nome,
  onToggle,
  toggleSuccessMsg,
}: {
  editarHref: Route;
  ativo: boolean;
  nome: string;
  onToggle: () => Promise<void>;
  toggleSuccessMsg: (novoEstado: boolean) => string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmaOpen, setConfirmaOpen] = useState(false);

  function executar() {
    startTransition(async () => {
      try {
        await onToggle();
        toast.success(toggleSuccessMsg(!ativo));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao executar");
      }
    });
  }

  function clicarToggle() {
    if (ativo) {
      setConfirmaOpen(true);
    } else {
      executar();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Ações" />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={editarHref} />}>
            <Pencil className="mr-2 size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            variant={ativo ? "destructive" : "default"}
            render={<button type="button" onClick={clicarToggle} />}
          >
            {ativo ? (
              <PowerOff className="mr-2 size-4" />
            ) : (
              <Power className="mr-2 size-4" />
            )}
            {ativo ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmaOpen} onOpenChange={setConfirmaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar &quot;{nome}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro fica inativo mas o histórico é preservado. Pode ser
              reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executar} disabled={pending}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
