"use client";

import { useState, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Search, Trash2, CalendarClock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { rotularCategoria, rotularEstadoOperacao, varianteEstado } from "@/operacao/rotulo-estado";
import { cancelarLoteAction, listarSlotsOsAdminAction, reagendarLinhaAction } from "./actions";

interface ItemAgendaView {
  osId: string;
  estado: string;
  agendadoParaISO: string;
  categoria: string;
  clienteNome: string;
  clienteWhatsapp: string;
  tecnicoNome: string;
  solicitacaoId: string;
}

const TZ = "America/Sao_Paulo";
const fmtDataLocal = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: TZ,
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export function AdminAgendaView({ itensIniciais }: { itensIniciais: ItemAgendaView[] }) {
  const [itens, setItens] = useState<ItemAgendaView[]>(itensIniciais);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Diálogo de cancelamento
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelIds, setCancelIds] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [cancelando, startCancelar] = useTransition();

  // Diálogo de reagendamento
  const [reagendarOpen, setReagendarOpen] = useState(false);
  const [reagendarOsId, setReagendarOsId] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ inicioISO: string }[]>([]);
  const [slotSelecionado, setSlotSelecionado] = useState<string | null>(null);
  const [motivoReagendar, setMotivoReagendar] = useState("");
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [reagendando, startReagendar] = useTransition();

  // Filtra itens
  const query = search.trim().toLowerCase();
  const itensFiltrados = itens.filter(
    (item) =>
      item.clienteNome.toLowerCase().includes(query) ||
      item.tecnicoNome.toLowerCase().includes(query) ||
      item.categoria.toLowerCase().includes(query) ||
      rotularEstadoOperacao(item.estado).toLowerCase().includes(query)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const cancelaveis = itensFiltrados
      .filter((x) => ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"].includes(x.estado))
      .map((x) => x.osId);

    if (selectedIds.length === cancelaveis.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cancelaveis);
    }
  };

  const abrirCancelar = (ids: string[]) => {
    setCancelIds(ids);
    setMotivo("");
    setCancelOpen(true);
  };

  const executarCancelar = () => {
    if (motivo.trim().length < 10) {
      toast.error("O motivo deve conter ao menos 10 caracteres.");
      return;
    }

    startCancelar(async () => {
      const results = await cancelarLoteAction(cancelIds, motivo);
      const falhas = results.filter((r) => !r.ok);

      if (falhas.length === 0) {
        toast.success(`${cancelIds.length} visita(s) cancelada(s) com sucesso!`);
        // Atualiza estados locais
        setItens((prev) =>
          prev.map((item) =>
            cancelIds.includes(item.osId) ? { ...item, estado: "CANCELADA" } : item
          )
        );
        setSelectedIds([]);
        setCancelOpen(false);
      } else {
        toast.error(
          `Falha ao cancelar algumas visitas: ${falhas.length} erro(s). Veja os toasts.`
        );
        for (const f of falhas) {
          toast.error(`OS #${f.osId.slice(0, 8)}: ${f.erro}`);
        }
        // Atualiza quem deu certo
        const okIds = results.filter((r) => r.ok).map((r) => r.osId);
        setItens((prev) =>
          prev.map((item) =>
            okIds.includes(item.osId) ? { ...item, estado: "CANCELADA" } : item
          )
        );
        setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)));
        setCancelOpen(false);
      }
    });
  };

  const abrirReagendar = async (osId: string) => {
    setReagendarOsId(osId);
    setSlotSelecionado(null);
    setMotivoReagendar("");
    setReagendarOpen(true);
    setCarregandoSlots(true);

    try {
      const res = await listarSlotsOsAdminAction(osId);
      setSlots(res);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao carregar slots");
      setReagendarOpen(false);
    } finally {
      setCarregandoSlots(false);
    }
  };

  const executarReagendar = () => {
    if (!reagendarOsId || !slotSelecionado) return;
    if (motivoReagendar.trim().length < 10) {
      toast.error("O motivo deve conter ao menos 10 caracteres.");
      return;
    }

    startReagendar(async () => {
      const res = await reagendarLinhaAction(reagendarOsId, slotSelecionado, motivoReagendar);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Visita reagendada com sucesso!");
        // Atualiza estado local
        setItens((prev) =>
          prev.map((item) =>
            item.osId === reagendarOsId
              ? { ...item, estado: "AGENDADA", agendadoParaISO: slotSelecionado }
              : item
          )
        );
        setReagendarOpen(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtro e Ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, técnico..."
            className="pl-9 h-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {selectedIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto font-bold shadow cursor-pointer transition-all active:scale-95"
            onClick={() => abrirCancelar(selectedIds)}
          >
            <Trash2 className="mr-1.5 size-4" />
            Cancelar Selecionados ({selectedIds.length})
          </Button>
        )}
      </div>

      {itensFiltrados.length === 0 ? (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Calendar className="size-8 mb-2" />
            <p className="text-sm">Nenhuma visita agendada encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* View Desktop: Tabela de Visitas */}
          <div className="hidden md:block border rounded-lg overflow-hidden bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length ===
                          itensFiltrados.filter((x) =>
                            ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"].includes(x.estado)
                          ).length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.map((item) => {
                  const cancelavel = ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"].includes(
                    item.estado
                  );
                  const selecionado = selectedIds.includes(item.osId);
                  return (
                    <TableRow key={item.osId} className={selecionado ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          disabled={!cancelavel}
                          checked={selecionado}
                          onCheckedChange={() => toggleSelect(item.osId)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {fmtDataLocal.format(new Date(item.agendadoParaISO))}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.clienteNome}</div>
                        <div className="text-xs text-muted-foreground">{item.clienteWhatsapp}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rotularCategoria(item.categoria)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.tecnicoNome}</TableCell>
                      <TableCell>
                        <Badge variant={varianteEstado(item.estado)}>
                          {rotularEstadoOperacao(item.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {cancelavel && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 cursor-pointer text-xs"
                              onClick={() => abrirReagendar(item.osId)}
                            >
                              Reagendar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 cursor-pointer text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => abrirCancelar([item.osId])}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* View Mobile: Lista de Cards (§10.3 / §9) */}
          <div className="block md:hidden space-y-3">
            {itensFiltrados.map((item) => {
              const cancelavel = ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"].includes(
                item.estado
              );
              const selecionado = selectedIds.includes(item.osId);
              return (
                <Card
                  key={item.osId}
                  className={`border transition-all ${
                    selecionado ? "border-primary bg-primary/[0.02]" : "border-border/60"
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {cancelavel && (
                          <Checkbox
                            checked={selecionado}
                            onCheckedChange={() => toggleSelect(item.osId)}
                          />
                        )}
                        <span className="text-sm font-bold text-foreground">
                          {fmtDataLocal.format(new Date(item.agendadoParaISO))}
                        </span>
                      </div>
                      <Badge variant={varianteEstado(item.estado)} className="text-xs">
                        {rotularEstadoOperacao(item.estado)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Cliente</span>
                        <span className="font-semibold text-foreground">{item.clienteNome}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Técnico</span>
                        <span className="font-semibold text-foreground">{item.tecnicoNome}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Serviço</span>
                        <Badge variant="outline" className="mt-0.5 text-[10px]">
                          {rotularCategoria(item.categoria)}
                        </Badge>
                      </div>
                    </div>

                    {cancelavel && (
                      <div className="flex gap-2 pt-2 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-1/2 h-8 text-xs cursor-pointer"
                          onClick={() => abrirReagendar(item.osId)}
                        >
                          Reagendar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-1/2 h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          onClick={() => abrirCancelar([item.osId])}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Diálogo de Cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Visita Técnica</DialogTitle>
            <DialogDescription>
              Você está cancelando {cancelIds.length} visita(s). Insira o motivo abaixo (mínimo 10 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Digite o motivo do cancelamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={cancelando}
              onClick={() => setCancelOpen(false)}
              className="cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 10 || cancelando}
              onClick={executarCancelar}
              className="font-bold cursor-pointer"
            >
              {cancelando ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Reagendamento */}
      <Dialog open={reagendarOpen} onOpenChange={setReagendarOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reagendar Visita</DialogTitle>
            <DialogDescription>
              Selecione um dos horários disponíveis e informe o motivo do reagendamento (mínimo 10 caracteres).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 py-2 space-y-4">
            {carregandoSlots && (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2].map((j) => (
                        <Skeleton key={j} className="h-9 w-20 rounded" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!carregandoSlots && slots.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum horário disponível nos próximos 14 dias.
              </p>
            )}

            {!carregandoSlots &&
              slots.length > 0 &&
              (() => {
                // Agrupa
                const grupos = new Map<string, { rotulo: string; slots: { inicioISO: string }[] }>();
                for (const slot of slots) {
                  const d = new Date(slot.inicioISO);
                  const chave = d.toLocaleDateString("en-CA", { timeZone: TZ });
                  const grupo = grupos.get(chave) ?? {
                    rotulo: fmtDia.format(d),
                    slots: [] as { inicioISO: string }[],
                  };
                  grupo.slots.push(slot);
                  grupos.set(chave, grupo);
                }
                const listaGrupos = [...grupos.values()];

                return listaGrupos.map((grupo) => (
                  <div key={grupo.rotulo} className="space-y-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground capitalize">
                      {grupo.rotulo}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {grupo.slots.map((slot) => (
                        <Button
                          key={slot.inicioISO}
                          type="button"
                          size="sm"
                          variant={slotSelecionado === slot.inicioISO ? "default" : "outline"}
                          className="h-8 text-xs cursor-pointer"
                          onClick={() => setSlotSelecionado(slot.inicioISO)}
                        >
                          {fmtHora.format(new Date(slot.inicioISO))}
                        </Button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
          </div>

          <Textarea
            placeholder="Digite o motivo do reagendamento..."
            value={motivoReagendar}
            onChange={(e) => setMotivoReagendar(e.target.value)}
            className="min-h-24"
          />

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              disabled={reagendando}
              onClick={() => setReagendarOpen(false)}
              className="cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              disabled={!slotSelecionado || motivoReagendar.trim().length < 10 || reagendando}
              onClick={executarReagendar}
              className="font-bold cursor-pointer"
            >
              {reagendando ? "Reagendando..." : "Confirmar Reagendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
