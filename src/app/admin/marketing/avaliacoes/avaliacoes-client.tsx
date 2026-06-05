"use client";

import { useState, useTransition } from "react";
import { Star, CheckCircle2, Ban, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  criarTratativaAction,
  resolverAlertaAction,
  invalidarAvaliacaoAction,
} from "./actions";
import type { AvaliacaoAdminView } from "@/marketing/alerta-avaliacao-repo";
import type { NotaTecnicoView } from "@/marketing/nota-tecnico-repo";

interface MembroSimples {
  id: string;
  nome: string;
}

interface AvaliacoesClientProps {
  alertas: AvaliacaoAdminView[];
  membros: MembroSimples[];
  notasPorTecnico: NotaTecnicoView[];
}

function formatarData(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function BadgeStatus({ status }: { status: string }) {
  if (status === "INVALIDADA") {
    return <Badge variant="outline" className="text-xs border-border text-muted-foreground line-through">Invalidada</Badge>;
  }
  if (status === "RESOLVIDO") {
    return <Badge variant="outline" className="text-xs border-border text-muted-foreground">Resolvido</Badge>;
  }
  if (status === "REAVALIADO") {
    return <Badge className="text-xs bg-primary text-primary-foreground">Reavaliado</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">Pendente</Badge>;
}

function BadgeNota({ nota }: { nota: number }) {
  const variant = nota >= 4 ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className="font-semibold gap-1 tabular-nums">
      <Star className="size-3 fill-current" /> {nota}
    </Badge>
  );
}

// ----------------------------------------------------------------
// Dialog: Criar tratativa
// ----------------------------------------------------------------
function DialogCriarTratativa({
  alerta,
  membros,
}: {
  alerta: AvaliacaoAdminView;
  membros: MembroSimples[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState("LIGOU");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 16));

  function handleSubmit() {
    if (!descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    startTransition(async () => {
      const res = await criarTratativaAction(
        alerta.id,
        alerta.osId,
        tipo as "LIGOU" | "DESCONTO" | "OS_CORRECAO" | "OUTRO",
        descricao,
        responsavelId === "none" ? null : responsavelId,
        new Date(data).toISOString(),
      );
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Tratativa registrada");
        setOpen(false);
        setDescricao("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1 text-xs")}
      >
        <Plus className="size-3" /> Tratativa
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Tratativa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tipo-tratativa">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "LIGOU")}>
              <SelectTrigger id="tipo-tratativa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIGOU">Ligou para o cliente</SelectItem>
                <SelectItem value="DESCONTO">Ofereceu desconto</SelectItem>
                <SelectItem value="OS_CORRECAO">OS de correção</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao-tratativa">Descrição</Label>
            <Textarea
              id="descricao-tratativa"
              placeholder="Descreva a tratativa realizada..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="responsavel-tratativa">Responsável</Label>
            <Select value={responsavelId} onValueChange={(v) => setResponsavelId(v ?? "none")}>
              <SelectTrigger id="responsavel-tratativa">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {membros.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-tratativa">Data</Label>
            <Input
              id="data-tratativa"
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !descricao.trim()}>
            {isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// Dialog: Invalidar avaliação
// ----------------------------------------------------------------
function DialogInvalidar({ alerta }: { alerta: AvaliacaoAdminView }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");

  function handleSubmit() {
    if (!motivo.trim()) {
      toast.error("Motivo é obrigatório");
      return;
    }
    startTransition(async () => {
      const res = await invalidarAvaliacaoAction(alerta.osId, motivo);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Avaliação invalidada");
        setOpen(false);
        setMotivo("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        <Ban className="size-3" /> Invalidar
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invalidar Avaliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            A avaliação será removida da média do técnico. Esta ação é irreversível.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-invalidacao">Motivo <span className="text-destructive">*</span></Label>
            <Textarea
              id="motivo-invalidacao"
              placeholder="Ex: Spam, avaliação falsa, abuso..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isPending || !motivo.trim()}>
            {isPending ? "Invalidando..." : "Invalidar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// Botão: Resolver alerta
// ----------------------------------------------------------------
function BotaoResolver({ alertaId }: { alertaId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleResolver() {
    startTransition(async () => {
      const res = await resolverAlertaAction(alertaId);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Alerta resolvido — pedido de reavaliação enviado");
      }
    });
  }

  return (
    <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleResolver} disabled={isPending}>
      <CheckCircle2 className="size-3" />
      {isPending ? "Resolvendo..." : "Resolver"}
    </Button>
  );
}

// ----------------------------------------------------------------
// Painel de nota média por técnico
// ----------------------------------------------------------------
function PainelNotasTecnicos({ notas }: { notas: NotaTecnicoView[] }) {
  if (notas.length === 0) return null;

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Nota Média por Técnico</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {notas.map((n) => (
            <div key={n.tecnicoId} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-xs font-medium text-foreground truncate">{n.tecnicoNome ?? "—"}</span>
              <div className="flex items-center gap-1">
                <Star className="size-3.5 fill-primary text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {n.media !== null ? n.media.toFixed(1) : "—"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{n.total === 1 ? "1 avaliação" : `${n.total} avaliações`}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Linha de alerta (Desktop)
// ----------------------------------------------------------------
function LinhaAlerta({
  alerta,
  membros,
}: {
  alerta: AvaliacaoAdminView;
  membros: MembroSimples[];
}) {
  const podeResolver = alerta.status === "PENDENTE" && !alerta.avaliacaoInvalida;
  const podeInvalidar = !alerta.avaliacaoInvalida;

  return (
    <TableRow className={alerta.avaliacaoInvalida ? "opacity-50" : ""}>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {formatarData(alerta.criadoEm)}
      </TableCell>
      <TableCell className="font-medium text-foreground">
        {alerta.tecnicoNome ?? "—"}
      </TableCell>
      <TableCell className="text-center">
        <BadgeNota nota={alerta.nota} />
      </TableCell>
      <TableCell>
        <BadgeStatus status={alerta.avaliacaoInvalida ? "INVALIDADA" : alerta.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={alerta.comentarioOs ?? ""}>
        {alerta.avaliacaoInvalida ? (
          <span className="italic text-muted-foreground/50 text-xs">
            Invalidada: {alerta.avaliacaoMotivoInvalidacao}
          </span>
        ) : (
          alerta.comentarioOs || <span className="italic text-muted-foreground/50">Sem comentário</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 justify-end">
          <DialogCriarTratativa alerta={alerta} membros={membros} />
          {podeResolver && <BotaoResolver alertaId={alerta.id} />}
          {podeInvalidar && <DialogInvalidar alerta={alerta} />}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------
// Card mobile
// ----------------------------------------------------------------
function CardAlerta({
  alerta,
  membros,
}: {
  alerta: AvaliacaoAdminView;
  membros: MembroSimples[];
}) {
  const podeResolver = alerta.status === "PENDENTE" && !alerta.avaliacaoInvalida;
  const podeInvalidar = !alerta.avaliacaoInvalida;

  return (
    <Card className={alerta.avaliacaoInvalida ? "opacity-50" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{formatarData(alerta.criadoEm)}</span>
          <div className="flex items-center gap-1.5">
            <BadgeNota nota={alerta.nota} />
            <BadgeStatus status={alerta.avaliacaoInvalida ? "INVALIDADA" : alerta.status} />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Técnico:</p>
          <p className="text-sm font-semibold text-foreground">{alerta.tecnicoNome ?? "—"}</p>
        </div>

        {alerta.comentarioOs && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Comentário:</p>
            <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
              {alerta.comentarioOs}
            </p>
          </div>
        )}

        {alerta.avaliacaoInvalida && alerta.avaliacaoMotivoInvalidacao && (
          <p className="text-xs italic text-muted-foreground">
            Invalidada: {alerta.avaliacaoMotivoInvalidacao}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <DialogCriarTratativa alerta={alerta} membros={membros} />
          {podeResolver && <BotaoResolver alertaId={alerta.id} />}
          {podeInvalidar && <DialogInvalidar alerta={alerta} />}
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------
export function AvaliacoesClient({
  alertas: alertasIniciais,
  membros,
  notasPorTecnico,
}: AvaliacoesClientProps) {
  const [filtroNota, setFiltroNota] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTecnico, setFiltroTecnico] = useState("todos");

  const alertas = alertasIniciais.filter((a) => {
    if (filtroNota !== "todos" && a.nota !== parseInt(filtroNota)) return false;
    if (filtroStatus === "INVALIDA" && !a.avaliacaoInvalida) return false;
    if (filtroStatus !== "todos" && filtroStatus !== "INVALIDA" && (a.status !== filtroStatus || a.avaliacaoInvalida)) return false;
    if (filtroTecnico !== "todos" && a.tecnicoId !== filtroTecnico) return false;
    return true;
  });

  const tecnicosFiltro = membros.filter((m) =>
    alertasIniciais.some((a) => a.tecnicoId === m.id)
  );

  return (
    <div className="space-y-6">
      {/* Painel de notas por técnico */}
      <PainelNotasTecnicos notas={notasPorTecnico} />

      {/* Filtros */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nota</Label>
              <Select value={filtroNota} onValueChange={(v) => setFiltroNota(v ?? "todos")}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as notas</SelectItem>
                  {/* Alertas só existem para notas baixas (≤ 3★) — ver Filtro Inteligente. */}
                  {[1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? "todos")}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                  <SelectItem value="REAVALIADO">Reavaliado</SelectItem>
                  <SelectItem value="INVALIDA">Invalidada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Técnico</Label>
              <Select value={filtroTecnico} onValueChange={(v) => setFiltroTecnico(v ?? "todos")}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os técnicos</SelectItem>
                  {tecnicosFiltro.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      <p className="text-sm text-muted-foreground">
        {alertas.length} alerta{alertas.length !== 1 ? "s" : ""} encontrado{alertas.length !== 1 ? "s" : ""}
      </p>

      {alertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Star className="size-12 text-muted-foreground/40" />
          <p className="text-base font-medium text-foreground">Nenhum alerta encontrado</p>
          <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou aguarde novas avaliações.</p>
        </div>
      ) : (
        <>
          {/* Desktop: Tabela */}
          <div className="hidden md:block border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Data</TableHead>
                  <TableHead className="w-[160px]">Técnico</TableHead>
                  <TableHead className="w-[80px] text-center">Nota</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead className="w-[220px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((alerta) => (
                  <LinhaAlerta key={alerta.id} alerta={alerta} membros={membros} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <ul className="block md:hidden space-y-4">
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <CardAlerta alerta={alerta} membros={membros} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
