"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import type {
  GestaoAssinatura,
  PlanoOpcao,
} from "@/assinatura/gestao-assinatura-loader";
import type { StatusAssinatura } from "@/assinatura/assinatura-repo";
import {
  agendarDowngradeAction,
  cancelarAssinaturaAction,
  upgradeAssinaturaAction,
} from "@/app/portal/assinatura/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/utils";

const VARIANTE_STATUS: Record<
  StatusAssinatura,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ATIVA: "default",
  PENDENTE: "outline",
  PAUSADA: "secondary",
  INADIMPLENTE: "destructive",
  CANCELADA: "destructive",
};

const LABEL_STATUS: Record<StatusAssinatura, string> = {
  ATIVA: "Ativa",
  PENDENTE: "Aguardando pagamento",
  PAUSADA: "Pausada",
  INADIMPLENTE: "Pagamento pendente",
  CANCELADA: "Cancelada",
};

function fmtData(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

interface Props {
  gestao: GestaoAssinatura;
}

export function GestaoAssinaturaView({ gestao }: Props) {
  return (
    <div className="space-y-8">
      <PlanoAtualCard gestao={gestao} />
      <MudarPlanoCard
        opcoesUpgrade={gestao.opcoesUpgrade}
        opcoesDowngrade={gestao.opcoesDowngrade}
      />
      <CancelarCard cancelamentoPendente={gestao.cancelamentoPendente} />
    </div>
  );
}

function PlanoAtualCard({ gestao }: { gestao: GestaoAssinatura }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">{gestao.plano.nome}</CardTitle>
            <CardDescription>
              {formatBRL(gestao.plano.preco)} / mês
            </CardDescription>
          </div>
          <Badge variant={VARIANTE_STATUS[gestao.status]}>
            {LABEL_STATUS[gestao.status]}
          </Badge>
        </div>
      </CardHeader>
      {(gestao.planoPendenteNome || gestao.cancelamentoPendente) && (
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {gestao.planoPendenteNome && (
            <p>
              Mudança para o plano{" "}
              <span className="font-medium text-foreground">
                {gestao.planoPendenteNome}
              </span>{" "}
              agendada para {fmtData(gestao.fimCicloAtual)}.
            </p>
          )}
          {gestao.cancelamentoPendente && (
            <p>
              Cancelamento agendado para {fmtData(gestao.fimCicloAtual)}. Os
              benefícios seguem ativos até lá.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function MudarPlanoCard({
  opcoesUpgrade,
  opcoesDowngrade,
}: {
  opcoesUpgrade: PlanoOpcao[];
  opcoesDowngrade: PlanoOpcao[];
}) {
  if (opcoesUpgrade.length === 0 && opcoesDowngrade.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Mudar de plano</CardTitle>
        <CardDescription>
          Upgrade é imediato; downgrade vale a partir do próximo ciclo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {opcoesUpgrade.length > 0 && (
          <UpgradeForm opcoes={opcoesUpgrade} />
        )}
        {opcoesDowngrade.length > 0 && (
          <DowngradeForm opcoes={opcoesDowngrade} />
        )}
      </CardContent>
    </Card>
  );
}

function UpgradeForm({ opcoes }: { opcoes: PlanoOpcao[] }) {
  const [planoId, setPlanoId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [pix, setPix] = React.useState<{ valor: number; codigo: string } | null>(
    null,
  );

  function handle() {
    startTransition(async () => {
      const res = await upgradeAssinaturaAction(planoId);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Upgrade aplicado! Plano atualizado.");
      if (res.pixCopiaECola) {
        setPix({ valor: res.valor ?? 0, codigo: res.pixCopiaECola });
      }
    });
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        <ArrowUpCircle className="size-4 text-primary" />
        Fazer upgrade
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={planoId}
          onValueChange={(v) => setPlanoId(v ?? "")}
          disabled={pending}
        >
          <SelectTrigger className="w-full sm:flex-1">
            <SelectValue placeholder="Escolha o plano superior" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} — {formatBRL(p.preco)}/mês
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handle}
          disabled={!planoId || pending}
          className="w-full sm:w-auto"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processando
            </>
          ) : (
            "Fazer upgrade agora"
          )}
        </Button>
      </div>

      <Dialog open={pix !== null} onOpenChange={(o) => !o && setPix(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pague a diferença proporcional</DialogTitle>
            <DialogDescription>
              Copie o código Pix abaixo para pagar{" "}
              {pix ? formatBRL(pix.valor) : ""} referente aos dias restantes do
              ciclo. O novo plano já está ativo.
            </DialogDescription>
          </DialogHeader>
          {pix && (
            <Textarea
              readOnly
              value={pix.codigo}
              className="min-h-24 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (pix) {
                  navigator.clipboard?.writeText(pix.codigo);
                  toast.success("Código Pix copiado.");
                }
              }}
            >
              Copiar código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DowngradeForm({ opcoes }: { opcoes: PlanoOpcao[] }) {
  const [planoId, setPlanoId] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handle() {
    startTransition(async () => {
      const res = await agendarDowngradeAction(planoId);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Downgrade agendado para o fim do ciclo.");
      setPlanoId("");
    });
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        <ArrowDownCircle className="size-4 text-muted-foreground" />
        Fazer downgrade
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={planoId}
          onValueChange={(v) => setPlanoId(v ?? "")}
          disabled={pending}
        >
          <SelectTrigger className="w-full sm:flex-1">
            <SelectValue placeholder="Escolha o plano inferior" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} — {formatBRL(p.preco)}/mês
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handle}
          disabled={!planoId || pending}
          className="w-full sm:w-auto"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Agendando
            </>
          ) : (
            "Agendar downgrade"
          )}
        </Button>
      </div>
    </div>
  );
}

function CancelarCard({
  cancelamentoPendente,
}: {
  cancelamentoPendente: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (cancelamentoPendente) return null;

  function handle() {
    startTransition(async () => {
      const res = await cancelarAssinaturaAction(motivo);
      if (res.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Cancelamento agendado para o fim do ciclo.");
      setOpen(false);
      setMotivo("");
    });
  }

  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Cancelar assinatura
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar assinatura</DialogTitle>
            <DialogDescription>
              A cobrança recorrente para imediatamente. Os benefícios e visitas
              já agendadas seguem até o fim do ciclo pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-cancelamento" className="text-sm font-medium">
              Motivo do cancelamento{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo-cancelamento"
              placeholder="Conte por que está cancelando (ajuda a melhorarmos)."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={pending}
              className="min-h-24"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handle}
              disabled={!motivo.trim() || pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cancelando
                </>
              ) : (
                "Confirmar cancelamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
