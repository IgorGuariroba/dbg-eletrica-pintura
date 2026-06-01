"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listarSlotsOsAction,
  agendarOsAction,
  type SlotOferecido,
} from "./agendamento-actions";

const TZ = "America/Sao_Paulo";

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

/** Agrupa os slots por dia (no fuso de SP) preservando a ordem cronológica. */
function agruparPorDia(slots: SlotOferecido[]) {
  const grupos = new Map<string, { rotulo: string; slots: SlotOferecido[] }>();
  for (const slot of slots) {
    const d = new Date(slot.inicioISO);
    const chave = d.toLocaleDateString("en-CA", { timeZone: TZ });
    const grupo = grupos.get(chave) ?? { rotulo: fmtDia.format(d), slots: [] };
    grupo.slots.push(slot);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : "Não foi possível agendar";
}

export function AgendarOs({ token, osId }: { token: string; osId: string }) {
  const [aberto, setAberto] = useState(false);
  const [slots, setSlots] = useState<SlotOferecido[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmando, startConfirmar] = useTransition();

  async function carregarSlots() {
    setCarregando(true);
    setSelecionado(null);
    try {
      setSlots(await listarSlotsOsAction(token, osId));
    } catch (e) {
      toast.error(mensagemErro(e));
      setSlots([]);
    } finally {
      setCarregando(false);
    }
  }

  function abrir() {
    setAberto(true);
    void carregarSlots();
  }

  function confirmar() {
    if (!selecionado) return;
    startConfirmar(async () => {
      try {
        await agendarOsAction(token, osId, selecionado);
        toast.success("Serviço agendado! Você verá os detalhes abaixo.");
        setAberto(false);
      } catch (e) {
        toast.error(mensagemErro(e));
        // Slot pode ter sido tomado por outro cliente — recarrega a lista.
        await carregarSlots();
      }
    });
  }

  const grupos = slots ? agruparPorDia(slots) : [];

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button type="button" onClick={abrir}>
        <CalendarClock className="size-4" />
        Agendar agora
      </Button>
      <DialogContent className="max-h-[85vh] gap-0">
        <DialogHeader>
          <DialogTitle>Escolha um horário</DialogTitle>
          <DialogDescription>
            Horários disponíveis nos próximos 14 dias. Nós designamos o técnico
            certo para o serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 max-h-[50vh] space-y-6 overflow-y-auto pr-1">
          {carregando && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-10 w-20" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!carregando && grupos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum horário disponível nos próximos 14 dias. Em breve entramos
              em contato para agendar.
            </p>
          )}

          {!carregando &&
            grupos.map((grupo) => (
              <div key={grupo.rotulo} className="space-y-2">
                <p className="text-sm font-semibold capitalize">
                  {grupo.rotulo}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grupo.slots.map((slot) => (
                    <Button
                      key={slot.inicioISO}
                      type="button"
                      size="sm"
                      variant={
                        selecionado === slot.inicioISO ? "default" : "outline"
                      }
                      onClick={() => setSelecionado(slot.inicioISO)}
                    >
                      {fmtHora.format(new Date(slot.inicioISO))}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAberto(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selecionado || confirmando}
            onClick={confirmar}
          >
            {confirmando ? "Agendando…" : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
